#!/bin/bash

# 进入本文件所在目录，避免双击运行时找不到 Python 脚本。
cd "$(dirname "$0")"

echo "正在生成汇率 Excel 报表..."
echo

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3。请先安装 Python 3。"
  echo "推荐从这里下载安装：https://www.python.org/downloads/macos/"
  echo
  echo "按任意键关闭窗口。"
  read -n 1 -s
  exit 1
fi

# 检查依赖是否已安装。缺少依赖时，只提示用户安装，不自动改动环境。
python3 - <<'PY'
missing = []

try:
    import requests  # noqa: F401
except Exception:
    missing.append("requests")

try:
    import openpyxl  # noqa: F401
except Exception:
    missing.append("openpyxl")

if missing:
    print("缺少 Python 依赖：" + "、".join(missing))
    print("请先在当前文件夹执行：")
    print("pip3 install -r requirements.txt")
    raise SystemExit(1)
PY

if [ $? -ne 0 ]; then
  echo
  echo "安装完成后，请再次双击“生成汇率报表.command”。"
  echo "按任意键关闭窗口。"
  read -n 1 -s
  exit 1
fi

python3 scripts/exchange_report.py
status=$?

echo
if [ $status -eq 0 ]; then
  echo "汇率报表已生成，按任意键关闭窗口。"
else
  echo "运行失败，请查看上面的错误信息。按任意键关闭窗口。"
fi

read -n 1 -s
exit $status
