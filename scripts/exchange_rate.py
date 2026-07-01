#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""汇率在线查询逻辑。

这个模块只负责查询汇率数据，不生成任何 Word、Excel 或其他文档。
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

import requests


TIMEOUT_SECONDS = 15
FRANKFURTER_URL = "https://api.frankfurter.app/{day}"
CURRENCIES = ["USD", "CNY", "MYR", "SGD"]
CURRENCY_NAMES = {
    "USD": "美元",
    "CNY": "人民币",
    "MYR": "马来西亚币",
    "SGD": "新加坡元",
}
PERIOD_DAYS = {
    "realtime": 0,
    "1D": 1,
    "3D": 3,
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "1Y": 365,
    "3Y": 365 * 3,
    "5Y": 365 * 5,
    "10Y": 365 * 10,
}
PERIOD_LABELS = {
    "realtime": "实时",
    "1D": "1日",
    "3D": "3日",
    "1W": "1周",
    "1M": "1个月",
    "3M": "3个月",
    "1Y": "1年",
    "3Y": "3年",
    "5Y": "5年",
    "10Y": "10年",
}
SOURCE_NAME = "Frankfurter.app（欧洲央行公开汇率数据）"


@dataclass
class RateSnapshot:
    """保存某一天从接口返回的 USD 基准汇率。"""

    label: str
    requested_date: date
    data_date: str
    rates: dict[str, float]


def build_session() -> requests.Session:
    """创建带浏览器标识的请求会话。"""

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
            ),
            "Accept": "application/json,*/*",
        }
    )
    return session


def request_with_retry(session: requests.Session, url: str, params: dict[str, str], retries: int = 3) -> dict:
    """带简单重试的 JSON 请求，避免临时网络抖动直接导致失败。"""

    last_error: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, params=params, timeout=TIMEOUT_SECONDS)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.2 * attempt)

    raise RuntimeError(f"汇率接口请求失败，已重试 {retries} 次：{last_error}")


def fetch_usd_snapshot(session: requests.Session, label: str, requested_date: date) -> RateSnapshot:
    """抓取指定日期的 USD 对其他货币汇率。"""

    url = FRANKFURTER_URL.format(day=requested_date.isoformat())
    params = {"from": "USD", "to": "CNY,MYR,SGD"}
    payload = request_with_retry(session, url, params)

    rates = {"USD": 1.0}
    for currency in ["CNY", "MYR", "SGD"]:
        value = (payload.get("rates") or {}).get(currency)
        if not isinstance(value, (int, float)):
            raise RuntimeError(f"接口没有返回 {currency} 汇率")
        rates[currency] = float(value)

    data_date = payload.get("date")
    if not data_date:
        raise RuntimeError("接口没有返回数据日期")

    return RateSnapshot(label=label, requested_date=requested_date, data_date=data_date, rates=rates)


def cross_rate(snapshot: RateSnapshot, base: str, quote: str) -> float:
    """计算货币对汇率，例如 USD/CNY 或 CNY/USD。"""

    return snapshot.rates[quote] / snapshot.rates[base]


def pct_change(current: float, previous: float) -> Optional[float]:
    """计算涨跌百分比。涨跌百分比 = 当前汇率 / 历史汇率 - 1。"""

    if previous == 0:
        return None
    return current / previous - 1


def normalize_currency(value: str) -> str:
    """规范化币种代码。"""

    return (value or "").strip().upper()


def validate_pair(base: str, quote: str) -> tuple[str, str]:
    """检查用户选择的货币对是否合法。"""

    base = normalize_currency(base)
    quote = normalize_currency(quote)
    if base not in CURRENCIES:
        raise ValueError(f"不支持的基准货币：{base}")
    if quote not in CURRENCIES:
        raise ValueError(f"不支持的目标货币：{quote}")
    if base == quote:
        raise ValueError("基准货币和目标货币不能相同")
    return base, quote


def validate_period(period: str) -> str:
    """检查时间范围是否合法。"""

    period = (period or "realtime").strip()
    if period not in PERIOD_DAYS:
        raise ValueError(f"不支持的时间范围：{period}")
    return period


def collect_exchange_rate_pair(base: str, quote: str, period: str = "realtime") -> dict:
    """查询单个货币对并返回页面需要展示的数据。"""

    base, quote = validate_pair(base, quote)
    period = validate_period(period)

    session = build_session()
    today = datetime.now().date()
    current = fetch_usd_snapshot(session, "当前", today)
    current_rate = cross_rate(current, base, quote)

    start_snapshot = None
    start_rate = None
    change_amount = None
    change_percent = None
    requested_start_date = None

    if period != "realtime":
        requested_start_date = today - timedelta(days=PERIOD_DAYS[period])
        start_snapshot = fetch_usd_snapshot(session, PERIOD_LABELS[period], requested_start_date)
        start_rate = cross_rate(start_snapshot, base, quote)
        change_amount = current_rate - start_rate
        change_percent = pct_change(current_rate, start_rate)

    return {
        "base": base,
        "quote": quote,
        "pair": f"{base}/{quote}",
        "period": period,
        "period_label": PERIOD_LABELS[period],
        "current_rate": current_rate,
        "start_rate": start_rate,
        "change_amount": change_amount,
        "change_percent": change_percent,
        "requested_current_date": today.isoformat(),
        "current_date": current.data_date,
        "requested_start_date": requested_start_date.isoformat() if requested_start_date else None,
        "start_date": start_snapshot.data_date if start_snapshot else None,
        "source": SOURCE_NAME,
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
