# 金价 / 汇率 Web 报表生成器

这个项目可以生成两类报表：

- 金价 Word 报表：`.docx`
- 汇率 Excel 报表：`.xlsx`

现在支持 Web 版本：用户打开网页，点击按钮生成报表，然后通过浏览器下载到自己的电脑。

## 目录结构

```text
gold-price-report/
├── app.py
├── 生成金价报表.command
├── 生成汇率报表.command
├── scripts/
│   ├── gold_report.py
│   └── exchange_report.py
├── templates/
│   └── index.html
├── static/
│   ├── app.js
│   └── styles.css
├── reports/
│   ├── gold/
│   ├── exchange/
│   └── tmp/
├── requirements.txt
└── README.md
```

说明：

- `app.py` 是 Web 服务入口。
- `scripts/` 存放生成报表的程序。
- `reports/gold/` 存放本地金价 Word 报表。
- `reports/exchange/` 存放本地汇率 Excel 报表。
- `reports/tmp/` 存放 Web 用户临时生成的下载文件。

## 本地运行 Web 版本

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

页面上可以点击：

- `生成汇率 Excel 报表`
- `生成金价 Word 报表`

生成完成后，页面会显示：

- 文件名
- 文件大小
- 下载按钮
- 剩余有效时间

用户点击下载后，浏览器会把文件下载到用户自己的电脑。浏览器不允许网页直接保存到用户电脑的固定路径。

## 云部署

这个项目可以部署到 Render、Railway、Fly.io 或普通云服务器。

推荐生产启动命令：

```bash
gunicorn app:app --bind 0.0.0.0:$PORT
```

如果你的平台不用 `$PORT`，可以改成固定端口，例如：

```bash
gunicorn app:app --bind 0.0.0.0:8000
```

Render 示例：

```text
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app --bind 0.0.0.0:$PORT
```

Railway / Fly.io 也可以使用同样的启动命令。部署时不需要 `.command` 文件。

## 下载和临时文件规则

Web 版本不会把文件保存到用户电脑固定路径。流程是：

1. 用户在网页点击生成按钮。
2. 服务器生成 Word 或 Excel 文件。
3. 文件先保存到 `reports/tmp/`。
4. 服务器返回一个下载链接，例如 `/download/<file_id>`。
5. 用户点击下载，浏览器下载文件。
6. 文件默认保留 10 分钟。
7. 超过 10 分钟后，服务器会自动删除临时文件。

下载文件名会保持清晰，例如：

```text
汇率报表_2026-06-28_17-30.xlsx
金价报表_2026-06-28_17-30.docx
```

当前实现选择“保留 10 分钟方便重复下载”，不会在第一次下载后立即删除。过期后页面下载按钮会变灰，并提示“文件已过期，请重新生成”。

## 安全规则

下载接口不会暴露服务器真实文件路径。

项目使用 `file_id` 映射真实临时文件：

```text
/download/<file_id>
```

安全限制：

- `file_id` 必须是服务器生成的 UUID。
- 只能下载 `reports/tmp/` 里的临时报表文件。
- 只允许下载 `.docx` 和 `.xlsx`。
- 禁止通过 `../../` 访问服务器其他文件。
- 不能下载项目代码、配置文件或其他敏感文件。
- 每个临时文件都有过期时间。
- 服务器会定期清理过期文件。

## 本地双击运行

旧的 Mac 双击入口仍然保留，适合自己电脑本地使用：

```bash
chmod +x 生成金价报表.command
chmod +x 生成汇率报表.command
```

双击后：

- 金价报表保存到 `reports/gold/`
- 汇率报表保存到 `reports/exchange/`

Web 部署时不依赖 `.command` 文件。

## 终端运行脚本

金价报表：

```bash
python3 scripts/gold_report.py
```

汇率报表：

```bash
python3 scripts/exchange_report.py
```

## 常见问题

### 1. 网页生成失败怎么办？

可能原因：

- 服务器无法访问外部行情接口。
- Yahoo Finance、Swissquote、Frankfurter.app 临时不可用。
- 云平台阻止外部网络请求。
- 网络超时。

页面会显示失败原因。可以稍后重试。

### 2. 下载按钮变灰怎么办？

说明服务器临时文件已经超过 10 分钟有效期，被自动删除。请重新生成报表。

### 3. 为什么不能直接保存到用户电脑指定路径？

浏览器出于安全限制，不允许网页直接写入用户电脑固定路径。正确方式是服务器提供下载链接，由用户浏览器下载。

### 4. 部署后临时文件会一直占空间吗？

不会。`reports/tmp/` 里的文件默认 10 分钟过期，服务器会定期清理。

## 免责声明

本报表仅供参考，不构成投资建议。行情数据来自公开接口，可能存在延迟、缺失或接口变更。
