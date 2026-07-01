#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""金价在线查询逻辑。

这个模块只返回页面展示需要的数据，不生成任何 Word、Excel 或 PDF 文档。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

import requests


TIMEOUT_SECONDS = 15
YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]
YAHOO_CHART_URL = "https://{host}/v8/finance/chart/{symbol}"
SWISSQUOTE_XAU_URL = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD"
FRANKFURTER_URL = "https://api.frankfurter.app/latest"
TROY_OUNCE_GRAMS = 31.1035


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


def last_number(values: list[Optional[float]]) -> Optional[float]:
    """从列表中取最后一个有效数字。"""

    for value in reversed(values):
        if isinstance(value, (int, float)):
            return float(value)
    return None


def format_timestamp(timestamp: Optional[int], timezone_name: str = "") -> str:
    """把接口时间戳转换成可读时间。"""

    if not timestamp:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        zone = ZoneInfo(timezone_name) if timezone_name else None
        return datetime.fromtimestamp(timestamp, tz=zone).strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception:
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")


def fetch_yahoo_chart(session: requests.Session, symbol: str, range_value: str, interval: str) -> dict:
    """从 Yahoo Finance 抓取单个品种的图表数据。"""

    last_error = ""
    for host in YAHOO_HOSTS:
        try:
            url = YAHOO_CHART_URL.format(host=host, symbol=symbol)
            response = session.get(
                url,
                params={"range": range_value, "interval": interval},
                timeout=TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
            break
        except Exception as exc:
            last_error = f"{host}: {exc}"
    else:
        raise RuntimeError(last_error)

    chart = payload.get("chart", {})
    error = chart.get("error")
    if error:
        raise RuntimeError(error.get("description") or str(error))

    results = chart.get("result") or []
    if not results:
        raise RuntimeError("Yahoo Finance 没有返回行情数据")

    return results[0]


def fetch_yahoo_gold(session: requests.Session) -> dict:
    """从 Yahoo Finance 抓取黄金期货 GC=F，字段较完整。"""

    last_error = ""
    selected_interval = ""
    for range_value, interval in [("1d", "1m"), ("5d", "1d")]:
        try:
            result = fetch_yahoo_chart(session, "GC=F", range_value, interval)
            selected_interval = interval
            break
        except Exception as exc:
            last_error = f"{range_value}/{interval}: {exc}"
    else:
        raise RuntimeError(last_error)

    meta = result.get("meta", {})
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    close_values = quote.get("close") or []
    open_values = quote.get("open") or []
    high_values = quote.get("high") or []
    low_values = quote.get("low") or []

    current_price = meta.get("regularMarketPrice") or last_number(close_values)
    previous_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    open_price = meta.get("regularMarketOpen") or last_number(open_values)
    high_price = meta.get("regularMarketDayHigh") or last_number(high_values)
    low_price = meta.get("regularMarketDayLow") or last_number(low_values)

    if not isinstance(current_price, (int, float)):
        raise RuntimeError("Yahoo Finance 未返回有效金价")

    change_amount = None
    change_percent = None
    if isinstance(previous_close, (int, float)) and previous_close:
        change_amount = float(current_price) - float(previous_close)
        change_percent = change_amount / float(previous_close) * 100

    timestamps = result.get("timestamp") or []
    updated_at = format_timestamp(
        timestamps[-1] if timestamps else meta.get("regularMarketTime"),
        meta.get("exchangeTimezoneName", ""),
    )

    return {
        "symbol": "GC=F",
        "price_usd_oz": float(current_price),
        "change": change_amount,
        "change_percent": change_percent,
        "open": float(open_price) if isinstance(open_price, (int, float)) else None,
        "high": float(high_price) if isinstance(high_price, (int, float)) else None,
        "low": float(low_price) if isinstance(low_price, (int, float)) else None,
        "previous_close": float(previous_close) if isinstance(previous_close, (int, float)) else None,
        "updated_at": updated_at,
        "source": f"Yahoo Finance（GC=F 黄金期货，{selected_interval}）",
    }


def fetch_swissquote_gold(session: requests.Session) -> dict:
    """从 Swissquote 抓取 XAU/USD 现货买卖价，并取中间价。"""

    response = session.get(SWISSQUOTE_XAU_URL, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    payload = response.json()

    if not isinstance(payload, list) or not payload:
        raise RuntimeError("Swissquote 没有返回有效数据")

    for item in payload:
        prices = item.get("spreadProfilePrices") or []
        if not prices:
            continue

        price = prices[0]
        bid = price.get("bid")
        ask = price.get("ask")
        if isinstance(bid, (int, float)) and isinstance(ask, (int, float)):
            current_price = (float(bid) + float(ask)) / 2
            ts = item.get("ts")
            updated_at = (
                datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(ts, (int, float))
                else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
            return {
                "symbol": "XAUUSD",
                "price_usd_oz": current_price,
                "change": None,
                "change_percent": None,
                "open": None,
                "high": None,
                "low": None,
                "previous_close": None,
                "updated_at": updated_at,
                "source": "Swissquote（XAU/USD 现货）",
            }

    raise RuntimeError("Swissquote 没有返回有效买卖价")


def fetch_usd_cny(session: requests.Session) -> float:
    """抓取 USD/CNY 汇率，用于估算人民币每克价格。"""

    response = session.get(
        FRANKFURTER_URL,
        params={"from": "USD", "to": "CNY"},
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    cny = (payload.get("rates") or {}).get("CNY")
    if not isinstance(cny, (int, float)):
        raise RuntimeError("汇率接口未返回 USD/CNY")
    return float(cny)


def fetch_gold_price(symbol: str = "GC=F") -> dict:
    """抓取金价和 USD/CNY，并计算人民币每克估算价格。"""

    normalized_symbol = (symbol or "GC=F").strip().upper()
    session = build_session()
    errors = []

    source_order = [fetch_yahoo_gold, fetch_swissquote_gold]
    if normalized_symbol == "XAUUSD":
        source_order = [fetch_swissquote_gold, fetch_yahoo_gold]

    data = None
    for fetcher in source_order:
        try:
            data = fetcher(session)
            break
        except Exception as exc:
            errors.append(f"{fetcher.__name__}: {exc}")

    if data is None:
        raise RuntimeError("金价数据获取失败，请稍后重试。" + "；".join(errors))

    try:
        usd_cny = fetch_usd_cny(session)
    except Exception as exc:
        usd_cny = None
        errors.append(f"USD/CNY 获取失败：{exc}")

    data["usd_cny"] = usd_cny
    data["price_cny_gram"] = (
        data["price_usd_oz"] * usd_cny / TROY_OUNCE_GRAMS
        if isinstance(data.get("price_usd_oz"), (int, float)) and isinstance(usd_cny, (int, float))
        else None
    )
    # 成功时只展示实际采用的数据源，避免把备用源之前的失败细节暴露到页面。
    return data
