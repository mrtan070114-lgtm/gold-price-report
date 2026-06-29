#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from flask import Flask, abort, jsonify, render_template, request, send_file
from werkzeug.wsgi import ClosingIterator

from scripts.exchange_report import (
    build_pair_excel_report,
    build_pair_word_report,
    build_workbook,
    collect_exchange_data,
    collect_exchange_rate_pair,
)
from scripts.gold_report import build_docx_report, fetch_market_data


BASE_DIR = Path(__file__).resolve().parent
TMP_DIR = BASE_DIR / "reports" / "tmp"
REGISTRY_PATH = TMP_DIR / "registry.json"
FILE_TTL_SECONDS = 10 * 60
CLEANUP_INTERVAL_SECONDS = 60
DELETE_AFTER_DOWNLOAD = os.environ.get("DELETE_AFTER_DOWNLOAD") == "1"
ALLOWED_SUFFIXES = {".docx", ".xlsx"}
FILE_ID_RE = re.compile(r"^[0-9a-f]{32}$")
MIME_TYPES = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

app = Flask(__name__)
registry_lock = threading.Lock()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def isoformat(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def ensure_tmp_dir() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)


def load_registry() -> dict:
    ensure_tmp_dir()
    if not REGISTRY_PATH.exists():
        return {}
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_registry(registry: dict) -> None:
    ensure_tmp_dir()
    temp_path = REGISTRY_PATH.with_suffix(".tmp")
    temp_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(REGISTRY_PATH)


def safe_tmp_path(server_filename: str) -> Path:
    path = (TMP_DIR / server_filename).resolve()
    tmp_root = TMP_DIR.resolve()
    if tmp_root != path.parent:
        raise ValueError("非法文件路径")
    if path.suffix not in ALLOWED_SUFFIXES:
        raise ValueError("非法文件类型")
    return path


def cleanup_expired_files() -> None:
    now = utc_now()
    with registry_lock:
        registry = load_registry()
        changed = False
        for file_id, item in list(registry.items()):
            expired = True
            try:
                expired = parse_iso(item["expires_at"]) <= now
                path = safe_tmp_path(item["server_filename"])
            except Exception:
                path = None

            if expired:
                if path and path.exists():
                    path.unlink(missing_ok=True)
                registry.pop(file_id, None)
                changed = True

        registered = {item.get("server_filename") for item in registry.values()}
        for path in TMP_DIR.glob("*"):
            if path.name in {".gitkeep", REGISTRY_PATH.name, REGISTRY_PATH.with_suffix(".tmp").name}:
                continue
            if path.is_file() and path.name not in registered:
                try:
                    path.unlink()
                except OSError:
                    pass

        if changed:
            save_registry(registry)


def cleanup_worker() -> None:
    while True:
        cleanup_expired_files()
        time.sleep(CLEANUP_INTERVAL_SECONDS)


def start_cleanup_thread() -> None:
    thread = threading.Thread(target=cleanup_worker, daemon=True)
    thread.start()


def register_report(path: Path) -> dict:
    file_id = uuid4().hex
    original_name = path.name
    suffix = path.suffix
    server_filename = f"{file_id}{suffix}"
    server_path = safe_tmp_path(server_filename)
    path.replace(server_path)

    expires_at = utc_now() + timedelta(seconds=FILE_TTL_SECONDS)
    size = server_path.stat().st_size
    mimetype = MIME_TYPES.get(suffix, "application/octet-stream")

    item = {
        "file_id": file_id,
        "server_filename": server_filename,
        "download_name": original_name,
        "size": size,
        "mimetype": mimetype,
        "created_at": isoformat(utc_now()),
        "expires_at": isoformat(expires_at),
    }

    with registry_lock:
        registry = load_registry()
        registry[file_id] = item
        save_registry(registry)

    return public_file_info(item)


def public_file_info(item: dict) -> dict:
    expires_at = parse_iso(item["expires_at"])
    remaining = max(0, int((expires_at - utc_now()).total_seconds()))
    return {
        "file_id": item["file_id"],
        "filename": item["download_name"],
        "size": item["size"],
        "size_label": format_size(item["size"]),
        "expires_at": item["expires_at"],
        "remaining_seconds": remaining,
        "download_url": f"/download/{item['file_id']}/{quote(item['download_name'])}",
    }


def format_size(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / 1024 / 1024:.1f} MB"


def get_registry_item(file_id: str) -> dict | None:
    if not FILE_ID_RE.match(file_id):
        return None
    with registry_lock:
        registry = load_registry()
        return registry.get(file_id)


def remove_registry_item(file_id: str) -> None:
    with registry_lock:
        registry = load_registry()
        if registry.pop(file_id, None) is not None:
            save_registry(registry)


@app.before_request
def cleanup_before_request() -> None:
    cleanup_expired_files()


@app.get("/")
def index():
    return render_template("index.html", ttl_seconds=FILE_TTL_SECONDS)


@app.post("/api/generate/<report_type>")
def generate_report(report_type: str):
    try:
        ensure_tmp_dir()
        if report_type == "exchange":
            rows, snapshots, source = collect_exchange_data()
            output_path = build_workbook(rows, snapshots, source, output_dir=TMP_DIR)
        elif report_type == "gold":
            data = fetch_market_data()
            output_path = build_docx_report(data, output_dir=TMP_DIR)
        else:
            return jsonify({"ok": False, "error": "不支持的报表类型"}), 404

        info = register_report(output_path)
        return jsonify({"ok": True, "file": info})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/api/exchange-rate")
def exchange_rate():
    try:
        payload = request.get_json(silent=True) or {}
        data = collect_exchange_rate_pair(
            payload.get("from", "USD"),
            payload.get("to", "CNY"),
            payload.get("period", "realtime"),
        )
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.post("/api/exchange-report")
def exchange_report():
    try:
        payload = request.get_json(silent=True) or {}
        report_format = (payload.get("format") or "excel").strip().lower()
        data = collect_exchange_rate_pair(
            payload.get("from", "USD"),
            payload.get("to", "CNY"),
            payload.get("period", "realtime"),
        )

        ensure_tmp_dir()
        if report_format == "excel":
            output_path = build_pair_excel_report(data, output_dir=TMP_DIR)
        elif report_format == "word":
            output_path = build_pair_word_report(data, output_dir=TMP_DIR)
        else:
            return jsonify({"success": False, "error": "format 只能是 excel 或 word"}), 400

        info = register_report(output_path)
        return jsonify(
            {
                "success": True,
                "filename": info["filename"],
                "download_url": info["download_url"],
                "file": info,
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.get("/api/file/<file_id>")
def file_status(file_id: str):
    item = get_registry_item(file_id)
    if not item:
        return jsonify({"ok": False, "expired": True, "error": "文件不存在或已过期"}), 404
    if parse_iso(item["expires_at"]) <= utc_now():
        cleanup_expired_files()
        return jsonify({"ok": False, "expired": True, "error": "文件已过期，请重新生成"}), 410
    return jsonify({"ok": True, "file": public_file_info(item)})


@app.get("/download/<file_id>")
@app.get("/download/<file_id>/<path:_filename>")
def download(file_id: str, _filename: str | None = None):
    item = get_registry_item(file_id)
    if not item:
        abort(404)
    if parse_iso(item["expires_at"]) <= utc_now():
        cleanup_expired_files()
        abort(410)

    try:
        path = safe_tmp_path(item["server_filename"])
    except ValueError:
        abort(404)
    if not path.exists() or not path.is_file():
        abort(404)
    mimetype = MIME_TYPES.get(path.suffix, item["mimetype"])

    response = send_file(
        path,
        mimetype=mimetype,
        as_attachment=True,
        download_name=item["download_name"],
        conditional=False,
        etag=False,
        last_modified=None,
        max_age=0,
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"

    if DELETE_AFTER_DOWNLOAD and request.method == "GET":
        def delete_after_response() -> None:
            path.unlink(missing_ok=True)
            remove_registry_item(file_id)

        response.direct_passthrough = False
        response.response = ClosingIterator(response.response, [delete_after_response])

    return response


ensure_tmp_dir()
start_cleanup_thread()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
