const buttons = document.querySelectorAll("button[data-report]");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");
const filenameEl = document.getElementById("filename");
const filesizeEl = document.getElementById("filesize");
const remainingEl = document.getElementById("remaining");
const downloadEl = document.getElementById("download");
const directDownloadEl = document.getElementById("direct-download");
const downloadHelpEl = document.getElementById("download-help");
const downloadUrlEl = document.getElementById("download-url");
const copyDownloadUrlEl = document.getElementById("copy-download-url");
const clientHintEl = document.getElementById("client-hint");

let currentFile = null;
let countdownTimer = null;
const userAgent = navigator.userAgent || "";
const isWeChatBrowser = /MicroMessenger/i.test(userAgent);
const isMobileBrowser = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

if (window.location.protocol === "file:") {
  setBusy(true);
  setStatus("当前打开的是模板文件，按钮无法连接后端。请先运行 python3 app.py，然后访问 http://127.0.0.1:5000", true);
}

renderClientHint();

function setBusy(isBusy) {
  buttons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function renderClientHint() {
  if (isWeChatBrowser) {
    clientHintEl.textContent = "请点击右上角，在 Safari/Chrome 浏览器中打开后下载。";
    clientHintEl.hidden = false;
    return;
  }

  if (isMobileBrowser) {
    clientHintEl.textContent = "如果无法直接下载，请点击浏览器分享按钮，选择存储到文件。";
    clientHintEl.hidden = false;
  }
}

function formatRemaining(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function expireDownload() {
  downloadEl.classList.add("disabled");
  downloadEl.disabled = true;
  downloadEl.textContent = "文件已过期，请重新生成";
  directDownloadEl.hidden = true;
  directDownloadEl.removeAttribute("href");
  downloadHelpEl.hidden = true;
  downloadUrlEl.value = "";
  remainingEl.textContent = "已过期";
  setStatus("文件已过期，请重新生成。", true);
}

function renderFile(file) {
  currentFile = file;
  resultBox.hidden = false;
  filenameEl.textContent = file.filename;
  filesizeEl.textContent = file.size_label;
  downloadEl.disabled = false;
  downloadEl.textContent = "下载文档";
  downloadEl.classList.remove("disabled");
  const absoluteDownloadUrl = new URL(file.download_url, window.location.origin).href;
  directDownloadEl.href = absoluteDownloadUrl;
  directDownloadEl.download = file.filename;
  directDownloadEl.hidden = false;
  downloadUrlEl.value = absoluteDownloadUrl;
  downloadHelpEl.hidden = false;

  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  const expiresAt = new Date(file.expires_at).getTime();
  const tick = () => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    remainingEl.textContent = formatRemaining(remaining);
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      expireDownload();
    }
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function generateReport(reportType) {
  setBusy(true);
  resultBox.hidden = currentFile === null;
  setStatus("正在生成报表，请稍候...");

  try {
    const response = await fetch(`/api/generate/${reportType}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "生成失败");
    }
    renderFile(payload.file);
    setStatus("报表生成完成，可下载。");
  } catch (error) {
    setStatus(`生成失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function downloadCurrentFile() {
  if (!currentFile || downloadEl.disabled) {
    setStatus("文件已过期，请重新生成。", true);
    return;
  }

  if (isWeChatBrowser) {
    setStatus("请点击右上角，在 Safari/Chrome 浏览器中打开后下载。", true);
    return;
  }

  const link = document.createElement("a");
  link.href = new URL(currentFile.download_url, window.location.origin).href;
  link.download = currentFile.filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  if (isMobileBrowser) {
    setStatus("下载已开始。如果无法直接下载，请点击浏览器分享按钮，选择存储到文件。");
  } else {
    setStatus("下载已开始。如果浏览器没有保存文件，请点击下方直接打开下载地址。");
  }
}

async function copyDownloadUrl() {
  if (!downloadUrlEl.value) {
    setStatus("没有可复制的下载地址，请先生成报表。", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(downloadUrlEl.value);
    setStatus("下载地址已复制。请粘贴到 Safari 或 Chrome 地址栏打开。");
  } catch (error) {
    downloadUrlEl.focus();
    downloadUrlEl.select();
    document.execCommand("copy");
    setStatus("下载地址已选中。如未自动复制，请手动复制后粘贴到 Safari 或 Chrome。");
  }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    if (window.location.protocol === "file:") {
      setStatus("请不要直接打开 templates/index.html。请启动 Web 服务后访问 http://127.0.0.1:5000", true);
      return;
    }
    generateReport(button.dataset.report);
  });
});

downloadEl.addEventListener("click", downloadCurrentFile);
copyDownloadUrlEl.addEventListener("click", copyDownloadUrl);
