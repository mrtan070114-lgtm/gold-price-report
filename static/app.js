const fromCurrencyEl = document.getElementById("from-currency");
const toCurrencyEl = document.getElementById("to-currency");
const periodEl = document.getElementById("period");
const reportFormatFieldEl = document.getElementById("report-format-field");
const reportFormatEl = document.getElementById("report-format");
const countdownLabelEl = document.getElementById("countdown-target-label");
const countdownDaysEl = document.getElementById("countdown-days");
const countdownNoteDisplayEl = document.getElementById("countdown-note-display");
const countdownNoteEl = document.getElementById("countdown-note");
const countdownTargetDateEl = document.getElementById("countdown-target-date");
const loveStartDateEl = document.getElementById("love-start-date");
const countdownEditEl = document.getElementById("countdown-edit");
const countdownModalEl = document.getElementById("countdown-editor-modal");
const countdownSaveEl = document.getElementById("countdown-save");
const countdownCancelEl = document.getElementById("countdown-cancel");
const countdownCloseEl = document.getElementById("countdown-editor-close");
const countdownConfirmModalEl = document.getElementById("countdown-confirm-modal");
const countdownConfirmSaveEl = document.getElementById("countdown-confirm-save");
const countdownConfirmCancelEl = document.getElementById("countdown-confirm-cancel");
const countdownConfirmCloseEl = document.getElementById("countdown-confirm-close");
const confirmTargetDateEl = document.getElementById("confirm-target-date");
const confirmLoveStartDateEl = document.getElementById("confirm-love-start-date");
const confirmNoteEl = document.getElementById("confirm-note");
const saveToastEl = document.getElementById("save-toast");
const loveDaysEl = document.getElementById("love-days");
const queryRateEl = document.getElementById("query-rate");
const generateExchangeReportEl = document.getElementById("generate-exchange-report");
const statusBox = document.getElementById("status");
const clientHintEl = document.getElementById("client-hint");

const rateResultEl = document.getElementById("rate-result");
const periodOnlyEls = document.querySelectorAll(".period-only");
const resultBaseEl = document.getElementById("result-base");
const resultQuoteEl = document.getElementById("result-quote");
const resultPeriodEl = document.getElementById("result-period");
const resultCurrentEl = document.getElementById("result-current");
const resultCurrentHighlightEl = document.getElementById("result-current-highlight");
const resultTrendEl = document.getElementById("result-trend");
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
let countdownConfig = {
  target_date: "2026-07-30",
  note: "",
  love_start_date: "2024-09-22",
};
let pendingCountdownConfig = null;
let toastTimer = null;
const countdownConfigStorageKey = "heartBabyCountdownConfig";
const countdownSettingsStorageKey = "heartBabyCountdownSettings";
const countdownStorageKey = "heartBabyCountdownTargetDate";
const countdownNoteStorageKey = "heartBabyCountdownNote";
const successStatusPattern = /完成|已生成|下载已开始|已复制/;
const userAgent = navigator.userAgent || "";
const isWeChatBrowser = /MicroMessenger/i.test(userAgent);
const isMobileBrowser = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

if (window.location.protocol === "file:") {
  setBusy(true);
  setStatus("当前打开的是模板文件，按钮无法连接后端。请先运行 python3 app.py，然后访问 http://127.0.0.1:5000", true);
}

renderClientHint();
loadLocalCountdownConfig();
applyCountdownConfig(countdownConfig, false);
hydrateCountdownConfig();
syncModeUI();

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function normalizeCountdownNote(value) {
  return (value || "").trim();
}

function normalizeCountdownConfig(raw) {
  const source = raw || {};
  const targetDate = source.target_date || source.targetDate || countdownConfig.target_date;
  const loveStartDate = source.love_start_date || source.loveStartDate || countdownConfig.love_start_date;
  const target = parseDateInputValue(targetDate) ? targetDate : countdownConfig.target_date;
  const loveStart = parseDateInputValue(loveStartDate) ? loveStartDate : countdownConfig.love_start_date;
  const note = normalizeCountdownNote(source.note).slice(0, 100);

  return {
    target_date: target,
    note,
    love_start_date: loveStart,
  };
}

function loadLocalCountdownConfig() {
  try {
    const rawConfig = localStorage.getItem(countdownConfigStorageKey);
    const stored = rawConfig ? JSON.parse(rawConfig) : null;
    if (stored && typeof stored === "object") {
      countdownConfig = normalizeCountdownConfig(stored);
      return;
    }
  } catch (error) {
    // Ignore invalid local data and fall back to defaults.
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(countdownSettingsStorageKey) || "{}");
    countdownConfig = normalizeCountdownConfig({
      target_date: legacy.targetDate,
      note: legacy.note,
      love_start_date: legacy.loveStartDate,
    });
  } catch (error) {
    const legacyTarget = localStorage.getItem(countdownStorageKey);
    const legacyNote = localStorage.getItem(countdownNoteStorageKey);
    countdownConfig = normalizeCountdownConfig({
      target_date: legacyTarget,
      note: legacyNote,
    });
  }
}

function persistCountdownConfigLocal(config) {
  try {
    localStorage.setItem(countdownConfigStorageKey, JSON.stringify(config));
    localStorage.setItem(countdownSettingsStorageKey, JSON.stringify({
      targetDate: config.target_date,
      note: config.note,
      loveStartDate: config.love_start_date,
    }));
    localStorage.setItem(countdownStorageKey, config.target_date);
    if (config.note) {
      localStorage.setItem(countdownNoteStorageKey, config.note);
    } else {
      localStorage.removeItem(countdownNoteStorageKey);
    }
  } catch (error) {
    // Storage can be unavailable in some privacy modes; the backend remains the source of truth.
  }
}

function renderLoveDay(startDate) {
  if (!loveDaysEl || !startDate) {
    return;
  }

  const today = getTodayDate();
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((today.getTime() - startDate.getTime()) / msPerDay) + 1;
  loveDaysEl.textContent = String(Math.max(days, 1));
}

function formatCountdownLabel(date) {
  const today = getTodayDate();
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;
  return date.getFullYear() === today.getFullYear() ? monthDay : `${date.getFullYear()}年${monthDay}`;
}

function renderDateCountdown(target) {
  if (!countdownDaysEl || !target) {
    return;
  }

  const today = getTodayDate();
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((target.getTime() - today.getTime()) / msPerDay);
  countdownDaysEl.textContent = String(Math.max(days, 0));
  if (countdownLabelEl) {
    countdownLabelEl.textContent = formatCountdownLabel(target);
  }
}

function renderCountdownNote(value) {
  if (!countdownNoteDisplayEl) {
    return;
  }

  const note = normalizeCountdownNote(value);
  if (note) {
    countdownNoteDisplayEl.textContent = `♡ ${note}`;
    countdownNoteDisplayEl.title = note;
    countdownNoteDisplayEl.hidden = false;
  } else {
    countdownNoteDisplayEl.textContent = "";
    countdownNoteDisplayEl.removeAttribute("title");
    countdownNoteDisplayEl.hidden = true;
  }
}

function applyCountdownConfig(rawConfig, shouldPersistLocal = true) {
  countdownConfig = normalizeCountdownConfig(rawConfig);
  const target = parseDateInputValue(countdownConfig.target_date);
  const loveStart = parseDateInputValue(countdownConfig.love_start_date);

  if (countdownTargetDateEl) {
    countdownTargetDateEl.value = countdownConfig.target_date;
  }
  if (loveStartDateEl) {
    loveStartDateEl.value = countdownConfig.love_start_date;
  }
  if (countdownNoteEl) {
    countdownNoteEl.value = countdownConfig.note;
  }

  renderDateCountdown(target);
  renderLoveDay(loveStart);
  renderCountdownNote(countdownConfig.note);

  if (shouldPersistLocal) {
    persistCountdownConfigLocal(countdownConfig);
  }
  return true;
}

async function hydrateCountdownConfig() {
  if (window.location.protocol === "file:") {
    return;
  }

  try {
    const response = await fetch("/api/countdown-config", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "读取配置失败");
    }
    applyCountdownConfig(payload);
  } catch (error) {
    setStatus("倒计时配置读取失败，已使用本地显示。", true);
  }
}

function syncCountdownEditorFields() {
  if (countdownTargetDateEl) {
    countdownTargetDateEl.value = countdownConfig.target_date;
  }
  if (loveStartDateEl) {
    loveStartDateEl.value = countdownConfig.love_start_date;
  }
  if (countdownNoteEl) {
    countdownNoteEl.value = countdownConfig.note;
  }
}

function setModalOpenState() {
  const editorOpen = countdownModalEl && !countdownModalEl.hidden;
  const confirmOpen = countdownConfirmModalEl && !countdownConfirmModalEl.hidden;
  document.body.classList.toggle("modal-open", Boolean(editorOpen || confirmOpen));
}

function openCountdownEditor() {
  if (!countdownModalEl) {
    return;
  }

  syncCountdownEditorFields();
  countdownModalEl.hidden = false;
  setModalOpenState();
  if (countdownTargetDateEl) {
    countdownTargetDateEl.focus();
  }
}

function closeCountdownEditor() {
  if (!countdownModalEl) {
    return;
  }

  countdownModalEl.hidden = true;
  pendingCountdownConfig = null;
  closeCountdownConfirm(false);
  syncCountdownEditorFields();
  setModalOpenState();
}

function collectEditorConfig() {
  const targetDate = countdownTargetDateEl ? countdownTargetDateEl.value : "";
  const loveStartDate = loveStartDateEl ? loveStartDateEl.value : "";
  const note = countdownNoteEl ? normalizeCountdownNote(countdownNoteEl.value) : "";

  if (!parseDateInputValue(targetDate)) {
    throw new Error("目标日期格式必须是 YYYY-MM-DD");
  }
  if (!parseDateInputValue(loveStartDate)) {
    throw new Error("恋爱开始日期格式必须是 YYYY-MM-DD");
  }
  if (note.length > 100) {
    throw new Error("备注最多 100 个字符");
  }

  return {
    target_date: targetDate,
    note,
    love_start_date: loveStartDate,
  };
}

function openCountdownConfirm() {
  if (!countdownConfirmModalEl) {
    return;
  }

  try {
    pendingCountdownConfig = collectEditorConfig();
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  if (confirmTargetDateEl) {
    confirmTargetDateEl.textContent = pendingCountdownConfig.target_date;
  }
  if (confirmLoveStartDateEl) {
    confirmLoveStartDateEl.textContent = pendingCountdownConfig.love_start_date;
  }
  if (confirmNoteEl) {
    confirmNoteEl.textContent = pendingCountdownConfig.note || "无";
  }

  countdownConfirmModalEl.hidden = false;
  setModalOpenState();
}

function closeCountdownConfirm(clearPending = true) {
  if (!countdownConfirmModalEl) {
    return;
  }

  countdownConfirmModalEl.hidden = true;
  if (clearPending) {
    pendingCountdownConfig = null;
  }
  setModalOpenState();
}

function showSaveToast(message) {
  if (!saveToastEl) {
    return;
  }

  saveToastEl.textContent = message;
  saveToastEl.hidden = false;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    saveToastEl.hidden = true;
  }, 2200);
}

async function confirmSaveCountdownConfig() {
  if (!pendingCountdownConfig || !countdownConfirmSaveEl) {
    return;
  }

  countdownConfirmSaveEl.disabled = true;
  setButtonLoading(countdownConfirmSaveEl, "保存中...");

  try {
    const response = await fetch("/api/countdown-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingCountdownConfig),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "保存失败");
    }

    applyCountdownConfig(payload);
    closeCountdownConfirm();
    if (countdownModalEl) {
      countdownModalEl.hidden = true;
    }
    setModalOpenState();
    setStatus("倒计时配置已保存。");
    showSaveToast("保存成功");
  } catch (error) {
    setStatus(error.message || "保存失败，请稍后重试。", true);
  } finally {
    clearButtonLoading(countdownConfirmSaveEl);
    countdownConfirmSaveEl.disabled = false;
  }
}

function saveCountdownSettings() {
  openCountdownConfirm();
}

function setBusy(isBusy) {
  queryRateEl.disabled = isBusy;
  generateExchangeReportEl.disabled = isBusy;
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
  statusBox.classList.toggle("success", !isError && successStatusPattern.test(message));
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

function setButtonLoading(button, text) {
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }
  button.textContent = text;
  button.classList.add("is-loading");
}

function clearButtonLoading(button) {
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
  button.classList.remove("is-loading");
}

function getSelectedMode() {
  const selected = document.querySelector("input[name='query-mode']:checked");
  return selected ? selected.value : "online";
}

function setSelectedMode(mode) {
  const option = document.querySelector(`input[name='query-mode'][value='${mode}']`);
  if (option) {
    option.checked = true;
  }
  syncModeUI();
}

// 根据查询方式显示对应控件：在线查询不出现报表下载入口。
function syncModeUI() {
  const mode = getSelectedMode();
  const isReportMode = mode === "report";
  reportFormatFieldEl.hidden = !isReportMode;
  queryRateEl.hidden = isReportMode;
  generateExchangeReportEl.hidden = !isReportMode;

  if (!isReportMode) {
    clearReport();
  } else if (!currentFile) {
    downloadEl.hidden = true;
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

function describeTrend(data) {
  if (data.period === "realtime" || typeof data.change_percent !== "number") {
    return { text: "实时查询", className: "neutral" };
  }

  const threshold = 0.0001;
  if (data.change_percent > threshold) {
    return { text: "上涨", className: "up" };
  }
  if (data.change_percent < -threshold) {
    return { text: "下跌", className: "down" };
  }
  return { text: "波动较小", className: "neutral" };
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

// 渲染在线汇率结果，只更新页面，不生成任何文件。
function renderRateResult(data) {
  rateResultEl.hidden = false;
  resultBaseEl.textContent = data.base;
  resultQuoteEl.textContent = data.quote;
  resultPeriodEl.textContent = data.period_label;
  resultCurrentEl.textContent = formatRate(data.current_rate);
  resultCurrentHighlightEl.textContent = formatRate(data.current_rate);
  resultSourceEl.textContent = data.source;
  resultUpdatedEl.textContent = data.updated_at;

  const trend = describeTrend(data);
  resultTrendEl.textContent = trend.text;
  resultTrendEl.className = `trend-badge ${trend.className}`;

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

// 在线查询接口：只返回 JSON 数据，不写入 reports 文件夹。
async function queryExchangeRate() {
  setSelectedMode("online");
  clearReport();
  setButtonLoading(queryRateEl, "查询中...");
  setBusy(true);
  setStatus("正在查询汇率...");

  if (fromCurrencyEl.value === toCurrencyEl.value) {
    clearButtonLoading(queryRateEl);
    setBusy(false);
    setStatus("基准货币和目标货币不能相同。", true);
    return;
  }

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
    setStatus("服务连接失败，请刷新页面或稍后重试。", true);
  } finally {
    clearButtonLoading(queryRateEl);
    setBusy(false);
  }
}

// 报表生成接口：根据当前格式生成 Excel 或 Word，并返回下载链接。
async function generateExchangeReport() {
  setSelectedMode("report");
  setButtonLoading(generateExchangeReportEl, "生成中...");
  setBusy(true);
  setStatus("正在生成报表...");

  if (fromCurrencyEl.value === toCurrencyEl.value) {
    clearButtonLoading(generateExchangeReportEl);
    setBusy(false);
    setStatus("基准货币和目标货币不能相同。", true);
    return;
  }

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
    setStatus("服务连接失败，请刷新页面或稍后重试。", true);
  } finally {
    clearButtonLoading(generateExchangeReportEl);
    setBusy(false);
  }
}

// 使用临时 a 标签触发浏览器下载，兼容桌面和手机浏览器。
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
if (countdownEditEl) {
  countdownEditEl.addEventListener("click", openCountdownEditor);
}
if (countdownSaveEl) {
  countdownSaveEl.addEventListener("click", saveCountdownSettings);
}
if (countdownCancelEl) {
  countdownCancelEl.addEventListener("click", closeCountdownEditor);
}
if (countdownCloseEl) {
  countdownCloseEl.addEventListener("click", closeCountdownEditor);
}
if (countdownConfirmSaveEl) {
  countdownConfirmSaveEl.addEventListener("click", confirmSaveCountdownConfig);
}
if (countdownConfirmCancelEl) {
  countdownConfirmCancelEl.addEventListener("click", closeCountdownConfirm);
}
if (countdownConfirmCloseEl) {
  countdownConfirmCloseEl.addEventListener("click", closeCountdownConfirm);
}
document.querySelectorAll("[data-countdown-close]").forEach((el) => {
  el.addEventListener("click", closeCountdownEditor);
});
document.querySelectorAll("[data-countdown-confirm-close]").forEach((el) => {
  el.addEventListener("click", closeCountdownConfirm);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (countdownConfirmModalEl && !countdownConfirmModalEl.hidden) {
    closeCountdownConfirm();
    return;
  }
  if (countdownModalEl && !countdownModalEl.hidden) {
    closeCountdownEditor();
  }
});

document.querySelectorAll("input[name='query-mode']").forEach((option) => {
  option.addEventListener("change", syncModeUI);
});
