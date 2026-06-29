const fromCurrencyEl = document.getElementById("from-currency");
const toCurrencyEl = document.getElementById("to-currency");
const periodEl = document.getElementById("period");
const reportFormatEl = document.getElementById("report-format");
const queryRateEl = document.getElementById("query-rate");
const generateExchangeReportEl = document.getElementById("generate-exchange-report");
const legacyReportButtons = document.querySelectorAll("button[data-report]");
const statusBox = document.getElementById("status");
const clientHintEl = document.getElementById("client-hint");

const rateResultEl = document.getElementById("rate-result");
const periodOnlyEls = document.querySelectorAll(".period-only");
const resultBaseEl = document.getElementById("result-base");
const resultQuoteEl = document.getElementById("result-quote");
const resultPeriodEl = document.getElementById("result-period");
const resultCurrentEl = document.getElementById("result-current");
const resultStartEl = document.getElementById("result-start");
const resultChangeEl = document.getElementById("result-change");
const resultPercentEl = document.getElementById("result-percent");
const resultSourceEl = document.getElementById("result-source");
const resultUpdatedEl = document.getElementById("result-updated");

const reportResultEl = document.getElementById("report-result");
const filenameEl = document.getElementById("filename");
const filesizeEl = document.getElementById("filesize");
const remainingEl = document.getElementById("remaining");
const downloadEl = document.getElementById("download");
const directDownloadEl = document.getElementById("direct-download");
const downloadHelpEl = document.getElementById("download-help");
const downloadUrlEl = document.getElementById("download-url");
const copyDownloadUrlEl = document.getElementById("copy-download-url");

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
  queryRateEl.disabled = isBusy;
  generateExchangeReportEl.disabled = isBusy;
  legacyReportButtons.forEach((button) => {
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

function getSelectedMode() {
  return document.querySelector("input[name='query-mode']:checked")?.value || "online";
}

function setSelectedMode(mode) {
  const option = document.querySelector(`input[name='query-mode'][value='${mode}']`);
  if (option) {
    option.checked = true;
  }
}

function getExchangePayload() {
  return {
    from: fromCurrencyEl.value,
    to: toCurrencyEl.value,
    period: periodEl.value,
  };
}

function getReportPayload() {
  return {
    ...getExchangePayload(),
    format: reportFormatEl.value,
  };
}

function formatRate(value) {
  return typeof value === "number" ? value.toFixed(6) : "-";
}

function formatPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "-";
}

function formatSignedRate(value) {
  if (typeof value !== "number") {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(6)}`;
}

function formatRemaining(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function clearReport() {
  currentFile = null;
  reportResultEl.hidden = true;
  downloadEl.hidden = true;
  directDownloadEl.hidden = true;
  directDownloadEl.removeAttribute("href");
  downloadHelpEl.hidden = true;
  downloadUrlEl.value = "";
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function expireDownload() {
  downloadEl.hidden = false;
  downloadEl.disabled = true;
  downloadEl.classList.add("disabled");
  downloadEl.textContent = "文件已过期，请重新生成";
  directDownloadEl.hidden = true;
  directDownloadEl.removeAttribute("href");
  downloadHelpEl.hidden = true;
  downloadUrlEl.value = "";
  remainingEl.textContent = "已过期";
  setStatus("文件已过期，请重新生成。", true);
}

function renderRateResult(data) {
  rateResultEl.hidden = false;
  resultBaseEl.textContent = data.base;
  resultQuoteEl.textContent = data.quote;
  resultPeriodEl.textContent = data.period_label;
  resultCurrentEl.textContent = formatRate(data.current_rate);
  resultSourceEl.textContent = data.source;
  resultUpdatedEl.textContent = data.updated_at;

  const isRealtime = data.period === "realtime";
  periodOnlyEls.forEach((el) => {
    el.hidden = isRealtime;
  });

  if (!isRealtime) {
    resultStartEl.textContent = formatRate(data.start_rate);
    resultChangeEl.textContent = formatSignedRate(data.change_amount);
    resultPercentEl.textContent = formatPercent(data.change_percent);
  }
}

function renderFile(file) {
  currentFile = file;
  reportResultEl.hidden = false;
  filenameEl.textContent = file.filename;
  filesizeEl.textContent = file.size_label || "-";
  downloadEl.hidden = false;
  downloadEl.disabled = false;
  downloadEl.textContent = "下载报表";
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

async function queryExchangeRate() {
  setSelectedMode("online");
  clearReport();
  setBusy(true);
  setStatus("正在查询汇率...");

  try {
    const response = await fetch("/api/exchange-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getExchangePayload()),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "查询失败");
    }
    renderRateResult(payload.data);
    setStatus("汇率查询完成。");
  } catch (error) {
    setStatus(`查询失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function generateExchangeReport() {
  setSelectedMode("report");
  setBusy(true);
  setStatus("正在生成报表...");

  try {
    const response = await fetch("/api/exchange-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getReportPayload()),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "生成失败");
    }
    renderFile(payload.file || {
      filename: payload.filename,
      download_url: payload.download_url,
      size_label: "-",
      expires_at: new Date(Date.now() + (window.REPORT_TTL_SECONDS || 600) * 1000).toISOString(),
    });
    setStatus("报表已生成，点击下载报表。");
  } catch (error) {
    setStatus(`生成失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function generateLegacyReport(reportType) {
  setBusy(true);
  setStatus("正在生成报表...");

  try {
    const response = await fetch(`/api/generate/${reportType}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "生成失败");
    }
    renderFile(payload.file);
    setStatus("报表已生成，点击下载报表。");
  } catch (error) {
    setStatus(`生成失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

function downloadCurrentFile() {
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

queryRateEl.addEventListener("click", queryExchangeRate);
generateExchangeReportEl.addEventListener("click", generateExchangeReport);
downloadEl.addEventListener("click", downloadCurrentFile);
copyDownloadUrlEl.addEventListener("click", copyDownloadUrl);

legacyReportButtons.forEach((button) => {
  button.addEventListener("click", () => generateLegacyReport(button.dataset.report));
});
