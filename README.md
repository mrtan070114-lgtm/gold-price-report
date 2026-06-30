# 汇率 Web 查询与报表工具

这个项目提供一个可部署到 Web 的汇率工具：

- 在线查询 USD、CNY、MYR、SGD 之间的汇率
- 支持实时、1日、1周、1个月、3个月、1年、3年、5年、10年时间范围
- 显示当前汇率、起始汇率、涨跌金额、涨跌百分比
- 可选择生成 Excel 或 Word 汇率报表
- 支持手机端下载提示和微信内置浏览器提示
- 支持把目标日期、备注、恋爱开始日期保存到后台数据库
- 支持部署到 Render

## 目录结构

```text
gold-price-report/
├── app.py
├── settings_store.py
├── 生成汇率报表.command
├── scripts/
│   └── exchange_report.py
├── templates/
│   └── index.html
├── static/
│   ├── app.js
│   └── styles.css
├── reports/
│   ├── exchange/
│   └── tmp/
├── requirements.txt
├── render.yaml
└── README.md
```

说明：

- `app.py` 是 Flask Web 服务入口。
- `settings_store.py` 负责后台配置的 PostgreSQL / SQLite 存储。
- `scripts/exchange_report.py` 负责汇率查询、Excel 报表、Word 报表生成。
- `templates/index.html` 是网页界面。
- `static/` 存放前端脚本和样式。
- `reports/tmp/` 存放 Web 用户临时生成的下载文件。

## 本地运行

进入项目文件夹：

```bash
cd /Users/mac/Documents/Codex/脚本:抓取金价/gold-price-report
```

安装依赖：

```bash
pip3 install -r requirements.txt
```

启动 Web 服务：

```bash
python3 app.py
```

浏览器打开：

```text
http://127.0.0.1:5000
```

不要直接打开 `templates/index.html`。这个文件只是 Flask 模板，直接打开时无法连接后端接口。

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

线上部署优先使用 PostgreSQL，并通过环境变量读取连接：

```text
DATABASE_URL=postgresql://...
```

本地开发如果没有配置 `DATABASE_URL`，程序会自动使用 SQLite 兜底，数据库文件位于：

```text
data/app_settings.sqlite3
```

Render 线上建议使用 Supabase、Neon 或 Render PostgreSQL，然后把它们提供的连接字符串配置到 `DATABASE_URL`。

不要把数据库密码、连接字符串或任何密钥写死在代码里，也不要提交到 Git。需要本地配置时可以放在未提交的 `.env` 或 shell 环境变量中。

## 页面功能

页面只有一个核心模块：汇率查询与报表下载。

用户可以选择：

- From 基准货币
- To 目标货币
- 时间范围
- 查询方式
- 报表格式

查询方式有两种：

- 仅在线查询，不下载文档
- 生成并下载报表

在线查询只调用 `/api/exchange-rate`，不会生成文件，也不会写入 `reports` 文件夹。

生成报表调用 `/api/exchange-report`，根据选择生成：

- Excel：`.xlsx`
- Word：`.docx`

## 下载和临时文件规则

Web 版本不会把文件保存到用户电脑固定路径。流程是：

1. 用户点击生成报表。
2. 服务器生成 Word 或 Excel 文件。
3. 文件先保存到 `reports/tmp/`。
4. 服务器返回下载链接。
5. 用户点击下载，浏览器保存文件。
6. 文件默认保留 10 分钟。
7. 超过 10 分钟后，服务器自动清理。

下载文件名示例：

```text
汇率报表_USD_CNY_1M_2026-06-29_12-00.xlsx
汇率报表_USD_CNY_1M_2026-06-29_12-00.docx
```

下载接口使用 Flask `send_file`，并设置 `as_attachment=True`。

## 手机端下载说明

手机浏览器下载文件的行为由浏览器控制。

页面会自动提示：

- 普通手机浏览器：如果无法直接下载，请点击浏览器分享按钮，选择存储到文件。
- 微信内置浏览器：请点击右上角，在 Safari/Chrome 浏览器中打开后下载。

## Render 部署

如果仓库根目录就是本项目目录，Render 可以直接使用：

```text
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app
```

如果仓库根目录是上一级目录，在 Render 的 `Root Directory` 填：

```text
gold-price-report
```

项目中也提供了 `render.yaml`，可作为 Render Blueprint 使用。

如果使用数据库保存倒计时配置，请在 Render 的 Environment Variables 中添加：

```text
DATABASE_URL
```

并确保依赖安装包含 `psycopg2-binary`。

## 安全规则

下载接口不会暴露服务器真实文件路径。

安全限制：

- 使用 `file_id` 映射真实临时文件。
- 只能下载 `reports/tmp/` 里的临时报表文件。
- 只允许下载 `.docx` 和 `.xlsx`。
- 禁止通过 `../../` 访问服务器其他文件。
- 不能下载项目代码、配置文件或其他敏感文件。
- 临时文件有过期时间并自动清理。

## 本地双击运行

保留汇率本地双击入口：

```bash
chmod +x 生成汇率报表.command
```

双击后会生成本地汇率 Excel 报表，保存到：

```text
reports/exchange/
```

Web 部署不依赖 `.command` 文件。

## 常见问题

### 1. 网页查询失败怎么办？

可能原因：

- 服务器无法访问外部汇率接口。
- Frankfurter.app 临时不可用。
- 云平台网络请求超时。

可以刷新页面或稍后重试。

### 2. 下载按钮变灰怎么办？

说明服务器临时文件已经超过有效期，被自动删除。请重新生成报表。

### 3. 为什么不能直接保存到用户电脑指定路径？

浏览器出于安全限制，不允许网页直接写入用户电脑固定路径。正确方式是服务器提供下载链接，由用户浏览器下载。

### 4. 部署后临时文件会一直占空间吗？

不会。`reports/tmp/` 里的文件默认 10 分钟过期，服务器会定期清理。

## 免责声明

本工具仅供参考，不构成投资建议。汇率数据来自公开接口，可能存在延迟、缺失或接口变更。
