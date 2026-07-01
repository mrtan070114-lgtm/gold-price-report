#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_COUNTDOWN_CONFIG = {
    "target_date": "2026-07-30",
    "note": "",
    "love_start_date": "2024-09-22",
}
COUNTDOWN_CONFIG_KEY = "countdown_config"
DATE_FORMAT = "%Y-%m-%d"
UPDATED_AT_FORMAT = "%Y-%m-%d %H:%M:%S"


class ConfigValidationError(ValueError):
    pass


class SettingsStore:
    def __init__(self, database_url: str | None = None, sqlite_path: Path | None = None) -> None:
        self.database_url = database_url if database_url is not None else os.environ.get("DATABASE_URL", "")
        self.sqlite_path = sqlite_path or BASE_DIR / "data" / "app_settings.sqlite3"
        self.lock = threading.Lock()

    @property
    def backend(self) -> str:
        return "postgres" if self.database_url else "sqlite"

    def get_countdown_config(self) -> dict[str, Any]:
        with self.lock:
            if self.backend == "postgres":
                stored = self._get_postgres_setting(COUNTDOWN_CONFIG_KEY)
            else:
                stored = self._get_sqlite_setting(COUNTDOWN_CONFIG_KEY)

        if not stored:
            return {
                **DEFAULT_COUNTDOWN_CONFIG,
                "updated_at": "",
            }

        value = self._normalize_saved_value(stored["value"])
        return {
            **value,
            "updated_at": self._format_updated_at(stored.get("updated_at")),
        }

    def save_countdown_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        value = normalize_countdown_payload(payload)
        updated_at = datetime.now().replace(microsecond=0)

        with self.lock:
            if self.backend == "postgres":
                stored = self._save_postgres_setting(COUNTDOWN_CONFIG_KEY, value)
            else:
                stored = self._save_sqlite_setting(COUNTDOWN_CONFIG_KEY, value, updated_at)

        saved_value = self._normalize_saved_value(stored["value"])
        return {
            **saved_value,
            "updated_at": self._format_updated_at(stored.get("updated_at")),
        }

    def _normalize_saved_value(self, value: Any) -> dict[str, str]:
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = {}
        if not isinstance(value, dict):
            value = {}

        return {
            "target_date": str(value.get("target_date") or DEFAULT_COUNTDOWN_CONFIG["target_date"]),
            "note": str(value.get("note") or ""),
            "love_start_date": str(value.get("love_start_date") or DEFAULT_COUNTDOWN_CONFIG["love_start_date"]),
        }

    def _format_updated_at(self, value: Any) -> str:
        if isinstance(value, datetime):
            return value.strftime(UPDATED_AT_FORMAT)
        if isinstance(value, str):
            return value
        return ""

    def _connect_postgres(self):
        try:
            import psycopg2
        except ImportError as exc:
            raise RuntimeError("缺少 psycopg2-binary，请先安装 PostgreSQL 依赖") from exc

        return psycopg2.connect(self.database_url)

    def _ensure_postgres_table(self, conn) -> None:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    key text PRIMARY KEY,
                    value jsonb NOT NULL,
                    updated_at timestamp NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at timestamp")
            cur.execute("UPDATE app_settings SET updated_at = NOW() WHERE updated_at IS NULL")
            cur.execute("ALTER TABLE app_settings ALTER COLUMN updated_at SET DEFAULT NOW()")
        conn.commit()

    def _get_postgres_setting(self, key: str) -> dict[str, Any] | None:
        with self._connect_postgres() as conn:
            self._ensure_postgres_table(conn)
            with conn.cursor() as cur:
                cur.execute("SELECT value, updated_at FROM app_settings WHERE key = %s", (key,))
                row = cur.fetchone()
                if not row:
                    return None
                return {"value": row[0], "updated_at": row[1]}

    def _save_postgres_setting(self, key: str, value: dict[str, str]) -> dict[str, Any]:
        value_json = json.dumps(value, ensure_ascii=False)
        with self._connect_postgres() as conn:
            self._ensure_postgres_table(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE app_settings
                    SET value = %s::jsonb,
                        updated_at = now()
                    WHERE key = %s
                    """,
                    (value_json, key),
                )
                if cur.rowcount == 0:
                    cur.execute(
                        """
                        INSERT INTO app_settings (key, value, updated_at)
                        VALUES (%s, %s::jsonb, now())
                        """,
                        (key, value_json),
                    )

                conn.commit()

                cur.execute("SELECT value, updated_at FROM app_settings WHERE key = %s", (key,))
                row = cur.fetchone()

        if not row:
            raise RuntimeError("保存后未能从数据库读取 countdown_config")
        return {"value": row[0], "updated_at": row[1]}

    def _connect_sqlite(self) -> sqlite3.Connection:
        self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_sqlite_table(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()

    def _get_sqlite_setting(self, key: str) -> dict[str, Any] | None:
        with self._connect_sqlite() as conn:
            self._ensure_sqlite_table(conn)
            row = conn.execute("SELECT value, updated_at FROM app_settings WHERE key = ?", (key,)).fetchone()
            if not row:
                return None
            return {"value": row["value"], "updated_at": row["updated_at"]}

    def _save_sqlite_setting(self, key: str, value: dict[str, str], updated_at: datetime) -> dict[str, Any]:
        updated_at_text = updated_at.strftime(UPDATED_AT_FORMAT)
        value_text = json.dumps(value, ensure_ascii=False)
        with self._connect_sqlite() as conn:
            self._ensure_sqlite_table(conn)
            conn.execute(
                """
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key)
                DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (key, value_text, updated_at_text),
            )
            conn.commit()
            row = conn.execute("SELECT value, updated_at FROM app_settings WHERE key = ?", (key,)).fetchone()
        return {"value": row["value"], "updated_at": row["updated_at"]}


def normalize_countdown_payload(payload: dict[str, Any]) -> dict[str, str]:
    target_date = validate_date(str(payload.get("target_date", "")).strip(), "目标日期")
    love_start_date = validate_date(str(payload.get("love_start_date", "")).strip(), "恋爱开始日期")
    note = str(payload.get("note", "")).strip()
    if len(note) > 100:
        raise ConfigValidationError("备注最多 100 个字符")

    return {
        "target_date": target_date,
        "note": note,
        "love_start_date": love_start_date,
    }


def validate_date(value: str, label: str) -> str:
    try:
        parsed = datetime.strptime(value, DATE_FORMAT)
    except ValueError as exc:
        raise ConfigValidationError(f"{label}格式必须是 YYYY-MM-DD") from exc
    if parsed.strftime(DATE_FORMAT) != value:
        raise ConfigValidationError(f"{label}无效")
    return value
