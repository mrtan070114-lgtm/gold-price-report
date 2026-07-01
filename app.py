#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import os

from flask import Flask, jsonify, render_template, request

from scripts.exchange_rate import CURRENCIES, CURRENCY_NAMES, collect_exchange_rate_pair
from scripts.gold_price import fetch_gold_price
from settings_store import ConfigValidationError, SettingsStore


app = Flask(__name__)
settings_store = SettingsStore()


@app.get("/")
def index():
    return render_template("index.html", active_tool="home")


@app.get("/tools/exchange")
def exchange_tool():
    return render_template("index.html", active_tool="exchange")


@app.get("/tools/gold")
def gold_tool():
    return render_template("index.html", active_tool="gold")


@app.get("/tools/countdown")
def countdown_tool():
    return render_template("index.html", active_tool="countdown")


@app.get("/tools/unit")
def unit_tool():
    return render_template("index.html", active_tool="unit")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/currencies")
def currencies():
    return jsonify(
        {
            "success": True,
            "currencies": [
                {"code": code, "name": CURRENCY_NAMES.get(code, code)}
                for code in CURRENCIES
            ],
        }
    )


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


@app.get("/api/gold-price")
def gold_price():
    try:
        symbol = request.args.get("symbol", "GC=F")
        data = fetch_gold_price(symbol)
        return jsonify({"success": True, **data})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 502


@app.get("/api/countdown-config")
def get_countdown_config():
    try:
        config = settings_store.get_countdown_config()
        return jsonify({"success": True, **config})
    except Exception as exc:
        return jsonify({"success": False, "error": f"读取配置失败：{exc}"}), 500


@app.post("/api/countdown-config")
def update_countdown_config():
    try:
        payload = request.get_json(silent=True) or {}
        config = settings_store.save_countdown_config(payload)
        return jsonify({"success": True, **config})
    except ConfigValidationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


# 兼容旧版本倒计时接口，避免线上旧页面缓存还在访问旧路径。
@app.get("/api/countdown-settings")
def get_countdown_settings():
    try:
        config = settings_store.get_countdown_config()
        return jsonify(
            {
                "success": True,
                "settings": {
                    "targetDate": config["target_date"],
                    "note": config["note"],
                    "loveStartDate": config["love_start_date"],
                    "updated_at": config["updated_at"],
                },
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": f"读取配置失败：{exc}"}), 500


@app.post("/api/countdown-settings")
def update_countdown_settings():
    try:
        payload = request.get_json(silent=True) or {}
        current = settings_store.get_countdown_config()
        config = settings_store.save_countdown_config(
            {
                "target_date": payload.get("target_date") or payload.get("targetDate") or current["target_date"],
                "note": payload.get("note", ""),
                "love_start_date": payload.get("love_start_date") or payload.get("loveStartDate") or current["love_start_date"],
            }
        )
        return jsonify(
            {
                "success": True,
                "settings": {
                    "targetDate": config["target_date"],
                    "note": config["note"],
                    "loveStartDate": config["love_start_date"],
                    "updated_at": config["updated_at"],
                },
            }
        )
    except ConfigValidationError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": f"保存配置失败：{exc}"}), 500


@app.post("/api/exchange-report")
@app.post("/api/gold-report")
def document_feature_gone():
    return jsonify({"success": False, "error": "文档下载功能已下架"}), 410


@app.get("/api/file/<file_id>")
@app.get("/download/<file_id>")
@app.get("/download/<file_id>/<path:_filename>")
def download_feature_gone(file_id: str, _filename: str | None = None):
    return jsonify({"success": False, "error": "文档下载功能已下架"}), 410


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
