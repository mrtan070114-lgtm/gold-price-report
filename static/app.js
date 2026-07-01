const activeTool = document.body.dataset.tool || "home";

const fromCurrencyEl = document.getElementById("from-currency");
const toCurrencyEl = document.getElementById("to-currency");
const periodEl = document.getElementById("period");
const queryRateEl = document.getElementById("query-rate");
const exchangeStatusEl = document.getElementById("exchange-status");

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

const goldSymbolEl = document.getElementById("gold-symbol");
const queryGoldEl = document.getElementById("query-gold");
const goldStatusEl = document.getElementById("gold-status");
const goldResultEl = document.getElementById("gold-result");
const goldTrendEl = document.getElementById("gold-trend");
const goldSymbolResultEl = document.getElementById("gold-symbol-result");
const goldPriceHighlightEl = document.getElementById("gold-price-highlight");
const goldPriceEl = document.getElementById("gold-price");
const goldChangeEl = document.getElementById("gold-change");
const goldPercentEl = document.getElementById("gold-percent");
const goldOpenEl = document.getElementById("gold-open");
const goldHighEl = document.getElementById("gold-high");
const goldLowEl = document.getElementById("gold-low");
const goldPreviousCloseEl = document.getElementById("gold-previous-close");
const goldUsdCnyEl = document.getElementById("gold-usd-cny");
const goldCnyGramEl = document.getElementById("gold-cny-gram");
const goldSourceEl = document.getElementById("gold-source");
const goldUpdatedEl = document.getElementById("gold-updated");

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
const countdownStatusEl = document.getElementById("countdown-status");

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
const successStatusPattern = /完成|成功|已保存/;

function setStatus(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("error", isError);
  element.classList.toggle("success", !isError && successStatusPattern.test(message));
}

function setButtonLoading(button, text) {
  if (!button) {
    return;
  }
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }
  button.textContent = text;
  button.disabled = true;
  button.classList.add("is-loading");
}

function clearButtonLoading(button) {
  if (!button) {
    return;
  }
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
  button.disabled = false;
  button.classList.remove("is-loading");
}

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
    // 本地缓存异常时直接使用默认值。
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(countdownSettingsStorageKey) || "{}");
    countdownConfig = normalizeCountdownConfig({
      target_date: legacy.targetDate,
      note: legacy.note,
      love_start_date: legacy.loveStartDate,
    });
  } catch (error) {
    countdownConfig = normalizeCountdownConfig({
      target_date: localStorage.getItem(countdownStorageKey),
      note: localStorage.getItem(countdownNoteStorageKey),
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
    // 部分浏览器隐私模式可能禁用 localStorage，后端数据库仍是主数据源。
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
    setStatus(countdownStatusEl, "倒计时配置读取成功。");
  } catch (error) {
    setStatus(countdownStatusEl, "倒计时配置读取失败，已使用本地显示。", true);
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
    setStatus(countdownStatusEl, error.message, true);
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
    setStatus(countdownStatusEl, "倒计时配置已保存。");
    showSaveToast("保存成功");
  } catch (error) {
    setStatus(countdownStatusEl, error.message || "保存失败，请稍后重试。", true);
  } finally {
    clearButtonLoading(countdownConfirmSaveEl);
  }
}

function saveCountdownSettings() {
  openCountdownConfirm();
}

function formatRate(value) {
  return typeof value === "number" ? value.toFixed(6) : "-";
}

function formatPrice(value, digits = 2) {
  return typeof value === "number" ? value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) : "-";
}

function formatPercentRatio(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "-";
}

function formatPercentPoints(value) {
  return typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "-";
}

function formatSignedRate(value) {
  if (typeof value !== "number") {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(6)}`;
}

function formatSignedPrice(value) {
  if (typeof value !== "number") {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${formatPrice(value)}`;
}

function describeExchangeTrend(data) {
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

function describeGoldTrend(data) {
  if (typeof data.change_percent !== "number") {
    return { text: "实时价格", className: "neutral" };
  }

  if (data.change_percent > 0.05) {
    return { text: "上涨", className: "up" };
  }
  if (data.change_percent < -0.05) {
    return { text: "下跌", className: "down" };
  }
  return { text: "波动较小", className: "neutral" };
}

function getExchangePayload() {
  return {
    from: fromCurrencyEl.value,
    to: toCurrencyEl.value,
    period: periodEl.value,
  };
}

function renderRateResult(data) {
  if (!rateResultEl) {
    return;
  }

  rateResultEl.hidden = false;
  resultBaseEl.textContent = data.base;
  resultQuoteEl.textContent = data.quote;
  resultPeriodEl.textContent = data.period_label;
  resultCurrentEl.textContent = formatRate(data.current_rate);
  resultCurrentHighlightEl.textContent = formatRate(data.current_rate);
  resultSourceEl.textContent = data.source;
  resultUpdatedEl.textContent = data.updated_at;

  const trend = describeExchangeTrend(data);
  resultTrendEl.textContent = trend.text;
  resultTrendEl.className = `trend-badge ${trend.className}`;

  const isRealtime = data.period === "realtime";
  periodOnlyEls.forEach((el) => {
    el.hidden = isRealtime;
  });

  if (!isRealtime) {
    resultStartEl.textContent = formatRate(data.start_rate);
    resultChangeEl.textContent = formatSignedRate(data.change_amount);
    resultPercentEl.textContent = formatPercentRatio(data.change_percent);
  }
}

async function queryExchangeRate() {
  if (!fromCurrencyEl || !toCurrencyEl || !periodEl || !queryRateEl) {
    return;
  }

  setButtonLoading(queryRateEl, "查询中...");
  setStatus(exchangeStatusEl, "正在查询汇率...");

  if (fromCurrencyEl.value === toCurrencyEl.value) {
    clearButtonLoading(queryRateEl);
    setStatus(exchangeStatusEl, "基准货币和目标货币不能相同。", true);
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
    setStatus(exchangeStatusEl, "汇率查询完成。");
  } catch (error) {
    setStatus(exchangeStatusEl, "服务连接失败，请刷新页面或稍后重试。", true);
  } finally {
    clearButtonLoading(queryRateEl);
  }
}

function renderGoldResult(data) {
  if (!goldResultEl) {
    return;
  }

  goldResultEl.hidden = false;
  goldSymbolResultEl.textContent = data.symbol || "-";
  goldPriceHighlightEl.textContent = formatPrice(data.price_usd_oz);
  goldPriceEl.textContent = formatPrice(data.price_usd_oz);
  goldChangeEl.textContent = formatSignedPrice(data.change);
  goldPercentEl.textContent = formatPercentPoints(data.change_percent);
  goldOpenEl.textContent = formatPrice(data.open);
  goldHighEl.textContent = formatPrice(data.high);
  goldLowEl.textContent = formatPrice(data.low);
  goldPreviousCloseEl.textContent = formatPrice(data.previous_close);
  goldUsdCnyEl.textContent = formatPrice(data.usd_cny, 4);
  goldCnyGramEl.textContent = formatPrice(data.price_cny_gram);
  goldSourceEl.textContent = data.source || "-";
  goldUpdatedEl.textContent = data.updated_at || "-";

  const trend = describeGoldTrend(data);
  goldTrendEl.textContent = trend.text;
  goldTrendEl.className = `trend-badge ${trend.className}`;
}

async function queryGoldPrice() {
  if (!queryGoldEl) {
    return;
  }

  setButtonLoading(queryGoldEl, "查询中...");
  setStatus(goldStatusEl, "正在查询金价...");

  try {
    const params = new URLSearchParams({
      symbol: goldSymbolEl ? goldSymbolEl.value : "GC=F",
    });
    const response = await fetch(`/api/gold-price?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "查询失败");
    }
    renderGoldResult(payload);
    setStatus(goldStatusEl, "金价查询完成。");
  } catch (error) {
    setStatus(goldStatusEl, "金价数据获取失败，请稍后重试。", true);
  } finally {
    clearButtonLoading(queryGoldEl);
  }
}

if (window.location.protocol === "file:") {
  setStatus(exchangeStatusEl, "当前打开的是模板文件，按钮无法连接后端。请先运行 Flask 服务后访问本地网址。", true);
  setStatus(goldStatusEl, "当前打开的是模板文件，按钮无法连接后端。请先运行 Flask 服务后访问本地网址。", true);
  setStatus(countdownStatusEl, "当前打开的是模板文件，按钮无法连接后端。请先运行 Flask 服务后访问本地网址。", true);
}

if (queryRateEl) {
  queryRateEl.addEventListener("click", queryExchangeRate);
}
if (queryGoldEl) {
  queryGoldEl.addEventListener("click", queryGoldPrice);
}

if (countdownDaysEl || loveDaysEl) {
  loadLocalCountdownConfig();
  applyCountdownConfig(countdownConfig, false);
  hydrateCountdownConfig();
}
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
