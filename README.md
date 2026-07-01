# 心宝在线工具箱

这是一个可以部署到 Render 的 Flask 在线工具箱，当前包含：

- 汇率查询：在线查询 USD、CNY、MYR、SGD 之间的汇率，支持实时、1日、3日、1周、1个月、3个月、1年、3年、5年、10年涨跌幅。
- 金价查询：在线查询黄金价格，并估算人民币每克价格。
- 倒计时：保存目标日期、恋爱开始日期和备注。
- 单位换算：建设中。

项目已经下架文档生成功能，不再生成或下载 Word、Excel、PDF 文件。

## 目录结构

```text
gold-price-report/
├── app.py
├── settings_store.py
├── scripts/
│   ├── exchange_rate.py
│   ├── gold_price.py
│   ├── exchange_report.py   # 历史脚本，Web 入口不再调用
│   └── gold_report.py       # 历史脚本，Web 入口不再调用
├── templates/
│   └── index.html
├── static/
│   ├── app.js
│   ├── styles.css
│   └── assets/site-logo.png
├── requirements.txt
├── render.yaml
└── README.md
```

## 本地运行

进入项目文件夹：

```bash
cd /Users/mac/Documents/Codex/iosapp/gold-price-report
```

安装依赖：

```bash
pip3 install -r requirements.txt
```

启动服务：

```bash
python3 app.py
```

浏览器打开：

```text
http://127.0.0.1:5000
```

不要直接打开 `templates/index.html`，它是 Flask 模板，直接打开无法连接后端接口。

## 页面路径

```text
/                  工具箱首页
/tools/exchange    汇率查询
/tools/gold        金价查询
/tools/countdown   倒计时
/tools/unit        单位换算（建设中）
```

## 后端接口

```text
GET  /health
GET  /api/currencies
POST /api/exchange-rate
GET  /api/gold-price
GET  /api/countdown-config
POST /api/countdown-config
```

历史文档接口已经下架，如果旧链接访问 `/api/exchange-report`、`/api/gold-report` 或 `/download/...`，会返回：

```json
{"success": false, "error": "文档下载功能已下架"}
```

## 数据库配置

目标日期、备注、恋爱开始日期会保存到数据库表 `app_settings` 中：

```text
key = countdown_config
value = {
  "target_date": "2026-07-30",
  "note": "2",
  "love_start_date": "2024-09-22"
}
```

线上部署使用 Supabase PostgreSQL，并通过环境变量读取连接：

```text
DATABASE_URL=postgresql://...
```

`DATABASE_URL` 不要上传 GitHub，不要写死在代码里。Render 上请在 Environment Variables 中配置。

本地开发如果没有配置 `DATABASE_URL`，程序会自动使用 SQLite 兜底，数据库文件位于：

```text
data/app_settings.sqlite3
```

## Render 部署

Render 填写：

```text
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app
```

如果仓库根目录不是本项目目录，请在 Render 的 `Root Directory` 填写项目所在目录。

项目包含 `.github/workflows/keepalive.yml`，GitHub Actions 会定时访问：

```text
https://gold-price-report.onrender.com/health
```

这个健康检查只返回简单 JSON，不会触发汇率或金价查询。

## 常见问题

### 1. 网页查询失败怎么办？

可能是外部数据接口临时不可用，或 Render 服务刚从休眠中唤醒。刷新页面或稍后重试。

### 2. 倒计时保存失败怎么办？

先检查 Render 是否配置了 `DATABASE_URL`。本地开发没有配置时会使用 SQLite，线上建议使用 Supabase PostgreSQL。

### 3. 金价没有开盘价、最高价、最低价怎么办？

当 Yahoo Finance 不可用时，系统会使用 Swissquote 现货价格备用源。备用源可能只提供当前价，不一定提供完整日内字段。

### 4. 手机端页面显示异常怎么办？

页面已经针对 iPhone Safari、Chrome 和微信内置浏览器做了横向溢出处理。如果仍然异常，先刷新页面清除旧缓存。

## 免责声明

本工具仅供参考，不构成投资建议。汇率和金价来自公开接口，可能存在延迟、缺失或接口变更。
