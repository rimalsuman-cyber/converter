/* =========================================================
   app.js
   Main application entry point.
   Responsibilities:
     1. Register the service worker (offline support)
     2. Handle page navigation (bottom nav + home cards + back buttons)
     3. Handle dark/light theme toggle + persistence
     4. Wire up each converter page to its logic module
   This file is intentionally "glue code" only — all math/logic
   lives in js/modules/*.js, all data-fetching in js/api/*.js,
   and shared helpers live in js/utils/*.js and js/config/*.js.
========================================================= */

import { kmToMiles, milesToKm } from "./modules/distance.js";
import { celsiusToFahrenheit, fahrenheitToCelsius } from "./modules/temperature.js";
import { kgToLbs, lbsToKg } from "./modules/weight.js";
import { metersToFeet, feetToMeters } from "./modules/length.js";
import { sqMetersToSqFeet, sqFeetToSqMeters } from "./modules/area.js";
import { litersToGallons, gallonsToLiters } from "./modules/volume.js";
import { kmhToMph, mphToKmh } from "./modules/speed.js";
import { createCalculatorEngine } from "./modules/calculator.js";
import { calculateBMI, getBMICategory } from "./modules/bmi.js";
import {
  calculateTipAmount,
  calculateTotalWithTip,
  calculatePerPersonShare,
} from "./modules/tip.js";
import {
  dateFromZoneInput,
  formatInZone,
  getLocalDateTimeValue,
} from "./modules/timezone.js";
import { canScanQrCodes, createQrCodeUrl } from "./modules/qr.js";
import { calculateScientificExpression } from "./modules/scientific.js";
import { calculateTax } from "./modules/tax.js";
import { calculatePercentage } from "./modules/percentage.js";
import { calculateAgeParts } from "./modules/age.js";
import { getExchangeRate, clearCurrencyCache } from "./api/currency.js";
import { roundTo, formatRelativeTime } from "./utils/format.js";
import { $, $$, debounce } from "./utils/dom.js";
import { readString, writeString } from "./utils/storage.js";
import {
  THEME_STORAGE_KEY,
  PAGE_TITLES,
  DEFAULT_PAGE_ID,
  CURRENCY_INPUT_DEBOUNCE_MS,
  TIP_DEFAULT_PERCENT,
} from "./config/constants.js";

const TOP_CURRENCIES = [
  { code: "ARS", label: "🇦🇷 Argentina — ARS, Argentine Peso" },
  { code: "AUD", label: "🇦🇺 Australia — AUD, Australian Dollar" },
  { code: "BHD", label: "🇧🇭 Bahrain — BHD, Bahraini Dinar" },
  { code: "BDT", label: "🇧🇩 Bangladesh — BDT, Bangladeshi Taka" },
  { code: "BRL", label: "🇧🇷 Brazil — BRL, Brazilian Real" },
  { code: "CAD", label: "🇨🇦 Canada — CAD, Canadian Dollar" },
  { code: "CLP", label: "🇨🇱 Chile — CLP, Chilean Peso" },
  { code: "CNY", label: "🇨🇳 China — CNY, Chinese Yuan" },
  { code: "COP", label: "🇨🇴 Colombia — COP, Colombian Peso" },
  { code: "CZK", label: "🇨🇿 Czech Republic — CZK, Czech Koruna" },
  { code: "DKK", label: "🇩🇰 Denmark — DKK, Danish Krone" },
  { code: "EGP", label: "🇪🇬 Egypt — EGP, Egyptian Pound" },
  { code: "EUR", label: "🇪🇺 European Union — EUR, Euro" },
  { code: "HKD", label: "🇭🇰 Hong Kong — HKD, Hong Kong Dollar" },
  { code: "HUF", label: "🇭🇺 Hungary — HUF, Hungarian Forint" },
  { code: "INR", label: "🇮🇳 India — INR, Indian Rupee" },
  { code: "IDR", label: "🇮🇩 Indonesia — IDR, Indonesian Rupiah" },
  { code: "ILS", label: "🇮🇱 Israel — ILS, Israeli Shekel" },
  { code: "JPY", label: "🇯🇵 Japan — JPY, Japanese Yen" },
  { code: "KES", label: "🇰🇪 Kenya — KES, Kenyan Shilling" },
  { code: "KWD", label: "🇰🇼 Kuwait — KWD, Kuwaiti Dinar" },
  { code: "MYR", label: "🇲🇾 Malaysia — MYR, Malaysian Ringgit" },
  { code: "MXN", label: "🇲🇽 Mexico — MXN, Mexican Peso" },
  { code: "MAD", label: "🇲🇦 Morocco — MAD, Moroccan Dirham" },
  { code: "NPR", label: "🇳🇵 Nepal — NPR, Nepalese Rupee" },
  { code: "NZD", label: "🇳🇿 New Zealand — NZD, New Zealand Dollar" },
  { code: "NGN", label: "🇳🇬 Nigeria — NGN, Nigerian Naira" },
  { code: "NOK", label: "🇳🇴 Norway — NOK, Norwegian Krone" },
  { code: "OMR", label: "🇴🇲 Oman — OMR, Omani Rial" },
  { code: "PKR", label: "🇵🇰 Pakistan — PKR, Pakistani Rupee" },
  { code: "PEN", label: "🇵🇪 Peru — PEN, Peruvian Sol" },
  { code: "PHP", label: "🇵🇭 Philippines — PHP, Philippine Peso" },
  { code: "PLN", label: "🇵🇱 Poland — PLN, Polish Zloty" },
  { code: "QAR", label: "🇶🇦 Qatar — QAR, Qatari Riyal" },
  { code: "RON", label: "🇷🇴 Romania — RON, Romanian Leu" },
  { code: "RUB", label: "🇷🇺 Russia — RUB, Russian Ruble" },
  { code: "SAR", label: "🇸🇦 Saudi Arabia — SAR, Saudi Riyal" },
  { code: "SGD", label: "🇸🇬 Singapore — SGD, Singapore Dollar" },
  { code: "ZAR", label: "🇿🇦 South Africa — ZAR, South African Rand" },
  { code: "KRW", label: "🇰🇷 South Korea — KRW, South Korean Won" },
  { code: "LKR", label: "🇱🇰 Sri Lanka — LKR, Sri Lankan Rupee" },
  { code: "SEK", label: "🇸🇪 Sweden — SEK, Swedish Krona" },
  { code: "CHF", label: "🇨🇭 Switzerland — CHF, Swiss Franc" },
  { code: "TWD", label: "🇹🇼 Taiwan — TWD, Taiwan Dollar" },
  { code: "THB", label: "🇹🇭 Thailand — THB, Thai Baht" },
  { code: "TRY", label: "🇹🇷 Turkey — TRY, Turkish Lira" },
  { code: "AED", label: "🇦🇪 United Arab Emirates — AED, UAE Dirham" },
  { code: "GBP", label: "🇬🇧 United Kingdom — GBP, British Pound" },
  { code: "USD", label: "🇺🇸 United States — USD, US Dollar" },
  { code: "VND", label: "🇻🇳 Vietnam — VND, Vietnamese Dong" },
];

/* ---------- 1. SERVICE WORKER REGISTRATION ---------- */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("service-worker.js")
      .then((reg) => console.log("[UnitKit] Service worker registered:", reg.scope))
      .catch((err) => console.error("[UnitKit] Service worker registration failed:", err));
  });
}

function disablePageZoomGestures() {
  document.addEventListener(
    "gesturestart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

/* ---------- 2. PAGE NAVIGATION ---------- */

/**
 * Shows the page with the given id and hides all others.
 * Updates the bottom-nav highlight, header title, and (for
 * accessibility) moves keyboard/screen-reader focus to the new
 * page's heading so assistive tech announces the page change —
 * the same thing a full page navigation would do natively.
 * @param {string} pageId
 */
function navigateTo(pageId) {
  const targetPage = document.getElementById(pageId);
  if (!targetPage) {
    console.warn(`[UnitKit] Tried to navigate to unknown page: "${pageId}"`);
    return;
  }

  $$(".page").forEach((page) => page.classList.remove("active"));
  targetPage.classList.add("active");

  // Sync bottom nav highlight + aria-current (only items that map to a page)
  $$(".nav-btn").forEach((btn) => {
    const isActive = btn.dataset.target === pageId;
    btn.classList.toggle("active", isActive);
    if (isActive) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });

  updateHeaderTitle(pageId);
  moveFocusToPageHeading(targetPage);

  // Scroll back to top when switching pages. `instant` avoids an
  // animated scroll competing with the page-enter animation.
  window.scrollTo({ top: 0, behavior: "instant" });
}

function updateHeaderTitle(pageId) {
  const titleEl = document.getElementById("page-title");
  if (titleEl) {
    titleEl.textContent = PAGE_TITLES[pageId] || PAGE_TITLES[DEFAULT_PAGE_ID];
  }
}

/**
 * Moves focus to a page's heading (or the page itself as a fallback)
 * after navigation, so screen reader users hear the new page's title
 * immediately instead of staying anchored to the button they just
 * pressed. `tabindex="-1"` lets an element receive focus
 * programmatically without adding it to the normal Tab order.
 * @param {Element} pageEl
 */
function moveFocusToPageHeading(pageEl) {
  const heading = pageEl.querySelector("h2, h1");
  const focusTarget = heading || pageEl;
  if (!focusTarget.hasAttribute("tabindex")) {
    focusTarget.setAttribute("tabindex", "-1");
  }
  focusTarget.focus({ preventScroll: true });
}

function setupNavigation() {
  // Any element with data-target navigates to that page (nav bar + home cards)
  $$("[data-target]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(el.dataset.target));
  });

  // Any element with data-back returns to the Home page
  $$("[data-back]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(DEFAULT_PAGE_ID));
  });
}

function setFieldValue(id, value, eventType = "input") {
  const field = document.getElementById(id);
  if (!field) return;

  field.value = value;
  field.dispatchEvent(new Event(eventType, { bubbles: true }));
}

function clickElement(selector) {
  document.querySelector(selector)?.click();
}

function resetActivePage() {
  const activePage = document.querySelector(".page.active");
  if (!activePage) return;

  switch (activePage.id) {
    case "page-distance":
      setFieldValue("km-input", "");
      break;
    case "page-temperature":
      setFieldValue("celsius-input", "");
      break;
    case "page-currency":
      setFieldValue("currency-source-select", "CHF", "change");
      setFieldValue("currency-target-select", "NPR", "change");
      setFieldValue("currency-amount-input", "1");
      break;
    case "page-weight":
      setFieldValue("kg-input", "");
      break;
    case "page-length":
      setFieldValue("meter-input", "");
      break;
    case "page-area":
      setFieldValue("sqm-input", "");
      break;
    case "page-volume":
      setFieldValue("liter-input", "");
      break;
    case "page-speed":
      setFieldValue("kmh-input", "");
      break;
    case "page-calculator":
      clickElement('[data-calculator-mode="standard"]');
      clickElement('[data-calc-action="clear"]');
      setFieldValue("calculator-scientific-expression-input", "sin(pi / 2) + sqrt(144)");
      break;
    case "page-bmi":
      setFieldValue("bmi-weight-input", "");
      setFieldValue("bmi-height-input", "");
      break;
    case "page-tip":
      setFieldValue("tip-bill-input", "");
      setFieldValue("tip-custom-input", "");
      setFieldValue("tip-people-input", "1");
      clickElement('[data-tip-percent="20"]');
      break;
    case "page-timezone":
      setFieldValue("timezone-datetime-input", getLocalDateTimeValue());
      setFieldValue("timezone-from-select", "Europe/Zurich", "change");
      setFieldValue("timezone-to-select", "Asia/Kathmandu", "change");
      break;
    case "page-qr":
      setFieldValue("qr-text-input", "https://rimalsuman-cyber.github.io/converter/");
      document.getElementById("qr-scan-result").textContent = "Scanner ready";
      break;
    case "page-tax":
      setFieldValue("tax-amount-input", "1000");
      setFieldValue("tax-rate-input", "18");
      setFieldValue("tax-mode-select", "exclusive", "change");
      break;
    case "page-percentage":
      setFieldValue("percentage-base-input", "250");
      setFieldValue("percentage-value-input", "12");
      setFieldValue("percentage-mode-select", "of", "change");
      break;
    case "page-age":
      setFieldValue("age-birth-input", "2000-01-01");
      setFieldValue("age-compare-input", new Date().toISOString().slice(0, 10));
      break;
    default:
      break;
  }
}

function setupResetButtons() {
  $$(".page").forEach((page) => {
    if (["page-home", "page-settings", "page-about"].includes(page.id)) return;

    const card = page.querySelector(".converter-card, .calculator-card");
    if (!card || card.querySelector(".reset-tool-btn")) return;

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "reset-tool-btn";
    resetButton.textContent = "Reset";
    resetButton.addEventListener("click", resetActivePage);
    card.append(resetButton);
  });
}

/* ---------- 3. THEME (LIGHT / DARK MODE) ---------- */
/* Note: to avoid a flash of the wrong theme on page load, the very
   first theme class is actually applied by a tiny inline script in
   index.html's <head> (runs before CSS/paint). The code below takes
   over from there for toggling + persistence during the session. */

function applyTheme(theme) {
  const isDark = theme === "dark";
  // Applied to <html> (not <body>) to match the inline no-flash-of-wrong-
  // theme script in index.html's <head>, which must set this before body
  // even exists yet.
  document.documentElement.classList.toggle("dark-theme", isDark);

  const darkModeSwitch = document.getElementById("dark-mode-switch");
  if (darkModeSwitch) darkModeSwitch.checked = isDark;
}

function getPreferredTheme() {
  const saved = readString(THEME_STORAGE_KEY);
  if (saved) return saved;

  return "dark";
}

function toggleTheme() {
  const isCurrentlyDark = document.documentElement.classList.contains("dark-theme");
  const newTheme = isCurrentlyDark ? "light" : "dark";
  writeString(THEME_STORAGE_KEY, newTheme);
  applyTheme(newTheme);
}

function setupTheme() {
  applyTheme(getPreferredTheme());

  const darkModeSwitch = document.getElementById("dark-mode-switch");
  darkModeSwitch?.addEventListener("change", toggleTheme);
}

/* ---------- 4. DISTANCE CONVERTER ---------- */

function setupDistanceConverter() {
  const kmInput = document.getElementById("km-input");
  const mileInput = document.getElementById("mile-input");
  const swapBtn = document.getElementById("distance-swap-btn");
  if (!kmInput || !mileInput || !swapBtn) return; // page not present — nothing to wire up

  kmInput.addEventListener("input", () => {
    const km = parseFloat(kmInput.value);
    mileInput.value = isNaN(km) ? "" : roundTo(kmToMiles(km));
  });

  mileInput.addEventListener("input", () => {
    const miles = parseFloat(mileInput.value);
    kmInput.value = isNaN(miles) ? "" : roundTo(milesToKm(miles));
  });

  swapBtn.addEventListener("click", () => {
    kmInput.value = "";
    mileInput.value = "";
    kmInput.focus();
  });
}

/* ---------- 5. TEMPERATURE CONVERTER ---------- */

function setupTemperatureConverter() {
  const celsiusInput = document.getElementById("celsius-input");
  const fahrenheitInput = document.getElementById("fahrenheit-input");
  const swapBtn = document.getElementById("temp-swap-btn");
  if (!celsiusInput || !fahrenheitInput || !swapBtn) return;

  celsiusInput.addEventListener("input", () => {
    const c = parseFloat(celsiusInput.value);
    fahrenheitInput.value = isNaN(c) ? "" : roundTo(celsiusToFahrenheit(c));
  });

  fahrenheitInput.addEventListener("input", () => {
    const f = parseFloat(fahrenheitInput.value);
    celsiusInput.value = isNaN(f) ? "" : roundTo(fahrenheitToCelsius(f));
  });

  swapBtn.addEventListener("click", () => {
    celsiusInput.value = "";
    fahrenheitInput.value = "";
    celsiusInput.focus();
  });
}

/* ---------- 6. WEIGHT CONVERTER ---------- */

function setupWeightConverter() {
  const kgInput = document.getElementById("kg-input");
  const lbsInput = document.getElementById("lbs-input");
  const swapBtn = document.getElementById("weight-swap-btn");
  if (!kgInput || !lbsInput || !swapBtn) return;

  kgInput.addEventListener("input", () => {
    const kg = parseFloat(kgInput.value);
    lbsInput.value = isNaN(kg) ? "" : roundTo(kgToLbs(kg));
  });

  lbsInput.addEventListener("input", () => {
    const lbs = parseFloat(lbsInput.value);
    kgInput.value = isNaN(lbs) ? "" : roundTo(lbsToKg(lbs));
  });

  swapBtn.addEventListener("click", () => {
    kgInput.value = "";
    lbsInput.value = "";
    kgInput.focus();
  });
}

/* ---------- 7. LENGTH CONVERTER ---------- */

function setupLengthConverter() {
  const meterInput = document.getElementById("meter-input");
  const feetInput = document.getElementById("feet-input");
  const swapBtn = document.getElementById("length-swap-btn");
  if (!meterInput || !feetInput || !swapBtn) return;

  meterInput.addEventListener("input", () => {
    const meters = parseFloat(meterInput.value);
    feetInput.value = isNaN(meters) ? "" : roundTo(metersToFeet(meters));
  });

  feetInput.addEventListener("input", () => {
    const feet = parseFloat(feetInput.value);
    meterInput.value = isNaN(feet) ? "" : roundTo(feetToMeters(feet));
  });

  swapBtn.addEventListener("click", () => {
    meterInput.value = "";
    feetInput.value = "";
    meterInput.focus();
  });
}

/* ---------- 8. AREA CONVERTER ---------- */

function setupAreaConverter() {
  const sqmInput = document.getElementById("sqm-input");
  const sqftInput = document.getElementById("sqft-input");
  const swapBtn = document.getElementById("area-swap-btn");
  if (!sqmInput || !sqftInput || !swapBtn) return;

  sqmInput.addEventListener("input", () => {
    const sqm = parseFloat(sqmInput.value);
    sqftInput.value = isNaN(sqm) ? "" : roundTo(sqMetersToSqFeet(sqm));
  });

  sqftInput.addEventListener("input", () => {
    const sqft = parseFloat(sqftInput.value);
    sqmInput.value = isNaN(sqft) ? "" : roundTo(sqFeetToSqMeters(sqft));
  });

  swapBtn.addEventListener("click", () => {
    sqmInput.value = "";
    sqftInput.value = "";
    sqmInput.focus();
  });
}

/* ---------- 9. VOLUME CONVERTER ---------- */

function setupVolumeConverter() {
  const literInput = document.getElementById("liter-input");
  const gallonInput = document.getElementById("gallon-input");
  const swapBtn = document.getElementById("volume-swap-btn");
  if (!literInput || !gallonInput || !swapBtn) return;

  literInput.addEventListener("input", () => {
    const liters = parseFloat(literInput.value);
    gallonInput.value = isNaN(liters) ? "" : roundTo(litersToGallons(liters));
  });

  gallonInput.addEventListener("input", () => {
    const gallons = parseFloat(gallonInput.value);
    literInput.value = isNaN(gallons) ? "" : roundTo(gallonsToLiters(gallons));
  });

  swapBtn.addEventListener("click", () => {
    literInput.value = "";
    gallonInput.value = "";
    literInput.focus();
  });
}

/* ---------- 10. SPEED CONVERTER ---------- */

function setupSpeedConverter() {
  const kmhInput = document.getElementById("kmh-input");
  const mphInput = document.getElementById("mph-input");
  const swapBtn = document.getElementById("speed-swap-btn");
  if (!kmhInput || !mphInput || !swapBtn) return;

  kmhInput.addEventListener("input", () => {
    const kmh = parseFloat(kmhInput.value);
    mphInput.value = isNaN(kmh) ? "" : roundTo(kmhToMph(kmh));
  });

  mphInput.addEventListener("input", () => {
    const mph = parseFloat(mphInput.value);
    kmhInput.value = isNaN(mph) ? "" : roundTo(mphToKmh(mph));
  });

  swapBtn.addEventListener("click", () => {
    kmhInput.value = "";
    mphInput.value = "";
    kmhInput.focus();
  });
}

/* ---------- 11. CURRENCY CONVERTER ---------- */

function setupCurrencyConverter() {
  const amountInput = document.getElementById("currency-amount-input");
  const sourceSelect = document.getElementById("currency-source-select");
  const sourceFlag = document.getElementById("currency-source-flag");
  const targetSelect = document.getElementById("currency-target-select");
  const targetFlag = document.getElementById("currency-target-flag");
  const resultEl = document.getElementById("currency-result");
  const statusEl = document.getElementById("currency-status");
  const refreshBtn = document.getElementById("currency-refresh-btn");
  if (!amountInput || !sourceSelect || !sourceFlag || !targetSelect || !targetFlag || !resultEl || !statusEl || !refreshBtn) return;

  const statusRow = statusEl.closest(".status-row");
  const currencyOptions = TOP_CURRENCIES
    .map((currency) => `<option value="${currency.code}">${currency.label}</option>`)
    .join("");

  sourceSelect.innerHTML = currencyOptions;
  targetSelect.innerHTML = currencyOptions;
  sourceSelect.value = "CHF";
  targetSelect.value = "NPR";

  function flagForCurrency(code) {
    return TOP_CURRENCIES.find((currency) => currency.code === code)?.label.split(" ")[0] || "🏳️";
  }

  function updateCurrencyFlags() {
    sourceFlag.textContent = flagForCurrency(sourceSelect.value);
    targetFlag.textContent = flagForCurrency(targetSelect.value);
  }

  /**
   * Re-calculates and displays the converted amount using
   * whatever rates are currently cached in the currency module.
   */
  async function updateResult({ forceRefresh = false } = {}) {
    const amount = parseFloat(amountInput.value) || 0;
    const sourceCurrency = sourceSelect.value;
    const targetCurrency = targetSelect.value;

    statusEl.textContent = "Fetching latest rates…";
    statusRow?.classList.remove("error");

    try {
      const { rate, lastUpdated, fromCache } = await getExchangeRate(
        sourceCurrency,
        targetCurrency,
        forceRefresh
      );

      const converted = amount * rate;
      resultEl.textContent = `${amount || 0} ${sourceCurrency} = ${roundTo(converted)} ${targetCurrency}`;

      statusEl.textContent = fromCache
        ? `Offline data — last updated ${formatRelativeTime(lastUpdated)}`
        : `Last updated ${formatRelativeTime(lastUpdated)}`;
    } catch (err) {
      // Graceful error handling: no internet, API down, timeout, etc.
      console.error("[UnitKit] Currency fetch failed:", err);
      statusRow?.classList.add("error");
      statusEl.textContent = "Couldn't fetch rates. Check your connection.";
      resultEl.textContent = "—";
    }
  }

  // Debounced so rapid typing doesn't fire a recalculation on every
  // keystroke — waits for a short pause before updating.
  const debouncedUpdate = debounce(updateResult, CURRENCY_INPUT_DEBOUNCE_MS);

  amountInput.addEventListener("input", () => debouncedUpdate());
  sourceSelect.addEventListener("change", () => {
    updateCurrencyFlags();
    updateResult();
  });
  targetSelect.addEventListener("change", () => {
    updateCurrencyFlags();
    updateResult();
  });
  refreshBtn.addEventListener("click", () => updateResult({ forceRefresh: true }));

  // Load rates as soon as the app starts
  updateCurrencyFlags();
  updateResult();
}

/* ---------- 12. CALCULATOR ---------- */

function setupCalculator() {
  const displayEl = document.getElementById("calculator-display");
  const calculatorCard = displayEl?.closest(".calculator-card");
  if (!displayEl || !calculatorCard) return;

  const modeButtons = $$(".calculator-mode-btn");
  const standardPanel = document.getElementById("calculator-standard-panel");
  const scientificPanel = document.getElementById("calculator-scientific-panel");
  const scientificInput = document.getElementById("calculator-scientific-expression-input");
  const scientificResult = document.getElementById("calculator-scientific-result");
  const engine = createCalculatorEngine();
  let activeCalculatorMode = "standard";

  function render() {
    displayEl.textContent = engine.getDisplay();
  }

  function setCalculatorMode(mode) {
    activeCalculatorMode = mode;
    standardPanel.hidden = mode !== "standard";
    scientificPanel.hidden = mode !== "scientific";

    modeButtons.forEach((button) => {
      const isActive = button.dataset.calculatorMode === mode;
      button.classList.toggle("calculator-mode-btn--active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (mode === "scientific") {
      scientificInput.focus();
    }
  }

  function updateInlineScientificResult() {
    const expression = scientificInput.value.trim();
    if (!expression) {
      scientificResult.textContent = "—";
      return;
    }

    try {
      scientificResult.textContent = roundTo(calculateScientificExpression(expression), 8);
    } catch (err) {
      scientificResult.textContent = "Invalid expression";
    }
  }

  // Single delegated listener on the button grid, instead of one
  // listener per button — less code, and automatically covers any
  // buttons added to the grid later.
  calculatorCard.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const { calcDigit, calcOperator, calcAction, calculatorMode, scientificInsert } = button.dataset;

    if (calculatorMode) {
      setCalculatorMode(calculatorMode);
      return;
    }

    if (scientificInsert !== undefined) {
      const start = scientificInput.selectionStart ?? scientificInput.value.length;
      const end = scientificInput.selectionEnd ?? scientificInput.value.length;
      scientificInput.value = `${scientificInput.value.slice(0, start)}${scientificInsert}${scientificInput.value.slice(end)}`;
      scientificInput.focus();
      scientificInput.setSelectionRange(start + scientificInsert.length, start + scientificInsert.length);
      updateInlineScientificResult();
      return;
    }

    if (calcDigit !== undefined) {
      engine.inputDigit(calcDigit);
    } else if (calcOperator !== undefined) {
      engine.setOperator(calcOperator);
    } else if (calcAction === "decimal") {
      engine.inputDecimal();
    } else if (calcAction === "clear") {
      engine.clear();
    } else if (calcAction === "toggle-sign") {
      engine.toggleSign();
    } else if (calcAction === "percent") {
      engine.percent();
    } else if (calcAction === "equals") {
      engine.equals();
    }

    render();
  });

  // Optional physical-keyboard support, active only while this page
  // is open — lets desktop users type instead of clicking.
  document.addEventListener("keydown", (event) => {
    const isCalculatorOpen = document.getElementById("page-calculator")?.classList.contains("active");
    if (!isCalculatorOpen || activeCalculatorMode !== "standard") return;

    if (event.key >= "0" && event.key <= "9") {
      engine.inputDigit(event.key);
    } else if (event.key === ".") {
      engine.inputDecimal();
    } else if (event.key === "+" || event.key === "-") {
      engine.setOperator(event.key);
    } else if (event.key === "*") {
      engine.setOperator("×");
    } else if (event.key === "/") {
      event.preventDefault(); // avoid triggering the browser's quick-find
      engine.setOperator("÷");
    } else if (event.key === "Enter" || event.key === "=") {
      engine.equals();
    } else if (event.key === "Backspace") {
      engine.backspace();
    } else if (event.key === "Escape") {
      engine.clear();
    } else {
      return; // unrelated key — skip the render below
    }

    render();
  });

  scientificInput.value = "sin(pi / 2) + sqrt(144)";
  scientificInput.addEventListener("input", updateInlineScientificResult);
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setCalculatorMode(button.dataset.calculatorMode));
  });
  updateInlineScientificResult();
  render();
}

/* ---------- 13. BMI CALCULATOR ---------- */

function setupBMICalculator() {
  const weightInput = document.getElementById("bmi-weight-input");
  const heightInput = document.getElementById("bmi-height-input");
  const resultEl = document.getElementById("bmi-result");
  const categoryEl = document.getElementById("bmi-category");
  const resultBox = resultEl?.closest(".result-box--bmi");
  if (!weightInput || !heightInput || !resultEl || !categoryEl) return;

  function setBmiTheme(category) {
    resultBox?.classList.remove(
      "bmi-underweight",
      "bmi-normal",
      "bmi-overweight",
      "bmi-obese"
    );

    if (category === "Underweight") resultBox?.classList.add("bmi-underweight");
    if (category === "Normal weight") resultBox?.classList.add("bmi-normal");
    if (category === "Overweight") resultBox?.classList.add("bmi-overweight");
    if (category === "Obese") resultBox?.classList.add("bmi-obese");
  }

  function updateResult() {
    const weightKg = parseFloat(weightInput.value);
    const heightCm = parseFloat(heightInput.value);

    if (isNaN(weightKg) || isNaN(heightCm) || weightKg <= 0 || heightCm <= 0) {
      resultEl.textContent = "—";
      categoryEl.textContent = "";
      setBmiTheme(null);
      return;
    }

    const bmi = calculateBMI(weightKg, heightCm);
    const category = getBMICategory(bmi);
    resultEl.textContent = `BMI: ${roundTo(bmi, 1)}`;
    categoryEl.textContent = category;
    setBmiTheme(category);
  }

  weightInput.addEventListener("input", updateResult);
  heightInput.addEventListener("input", updateResult);
}

/* ---------- 14. TIP CALCULATOR ---------- */

function setupTipCalculator() {
  const billInput = document.getElementById("tip-bill-input");
  const customInput = document.getElementById("tip-custom-input");
  const peopleInput = document.getElementById("tip-people-input");
  const tipAmountEl = document.getElementById("tip-amount-result");
  const totalEl = document.getElementById("tip-total-result");
  const perPersonEl = document.getElementById("tip-per-person-result");
  const presetButtons = $$(".tip-preset-btn");
  if (!billInput || !customInput || !peopleInput || !tipAmountEl || !totalEl || !perPersonEl) return;

  // Tracks which tip percentage is currently active — starts at the
  // preset that's marked active in the HTML (20%).
  let selectedTipPercent = TIP_DEFAULT_PERCENT;

  /** Visually highlights the preset button matching the given percent
   *  (or none, if a custom percentage is in use). */
  function highlightPreset(percent) {
    presetButtons.forEach((btn) => {
      const isMatch = Number(btn.dataset.tipPercent) === percent;
      btn.classList.toggle("tip-preset-btn--active", isMatch);
      btn.setAttribute("aria-pressed", String(isMatch));
    });
  }

  function updateResult() {
    const billAmount = parseFloat(billInput.value) || 0;
    const numberOfPeople = parseInt(peopleInput.value, 10) || 1;

    const tipAmount = calculateTipAmount(billAmount, selectedTipPercent);
    const total = calculateTotalWithTip(billAmount, tipAmount);
    const perPerson = calculatePerPersonShare(total, numberOfPeople);

    tipAmountEl.textContent = roundTo(tipAmount);
    totalEl.textContent = roundTo(total);
    perPersonEl.textContent = roundTo(perPerson);
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedTipPercent = Number(btn.dataset.tipPercent);
      customInput.value = ""; // a preset overrides any custom entry
      highlightPreset(selectedTipPercent);
      updateResult();
    });
  });

  customInput.addEventListener("input", () => {
    const customPercent = parseFloat(customInput.value);
    if (!isNaN(customPercent) && customPercent >= 0) {
      selectedTipPercent = customPercent;
      highlightPreset(null); // no preset matches a custom value
    }
    updateResult();
  });

  billInput.addEventListener("input", updateResult);
  peopleInput.addEventListener("input", updateResult);

  updateResult();
}

/* ---------- 15. TIME ZONE CONVERTER ---------- */

function setupTimeZoneConverter() {
  const dateTimeInput = document.getElementById("timezone-datetime-input");
  const fromSelect = document.getElementById("timezone-from-select");
  const toSelect = document.getElementById("timezone-to-select");
  const resultEl = document.getElementById("timezone-result");
  if (!dateTimeInput || !fromSelect || !toSelect || !resultEl) return;

  dateTimeInput.value = getLocalDateTimeValue();
  fromSelect.value = "Europe/Zurich";
  toSelect.value = "Asia/Kathmandu";

  function updateResult() {
    if (!dateTimeInput.value) {
      resultEl.textContent = "—";
      return;
    }

    const sourceDate = dateFromZoneInput(dateTimeInput.value, fromSelect.value);
    resultEl.textContent = formatInZone(sourceDate, toSelect.value);
  }

  dateTimeInput.addEventListener("input", updateResult);
  fromSelect.addEventListener("change", updateResult);
  toSelect.addEventListener("change", updateResult);
  updateResult();
}

/* ---------- 16. QR CODE GENERATOR / SCANNER ---------- */

function setupQrTool() {
  const textInput = document.getElementById("qr-text-input");
  const imageEl = document.getElementById("qr-code-image");
  const scanBtn = document.getElementById("qr-scan-btn");
  const closeBtn = document.getElementById("scanner-close-btn");
  const torchBtn = document.getElementById("scanner-torch-btn");
  const captureBtn = document.getElementById("document-capture-btn");
  const retakeBtn = document.getElementById("document-retake-btn");
  const useBtn = document.getElementById("document-use-btn");
  const videoEl = document.getElementById("qr-video");
  const previewCanvas = document.getElementById("scanner-preview-canvas");
  const cornerEditor = document.getElementById("document-corner-editor");
  const statusEl = document.getElementById("scanner-status");
  const resultEl = document.getElementById("qr-scan-result");
  const pageCountEl = document.getElementById("document-page-count");
  const openLinkBtn = document.getElementById("scanner-open-link-btn");
  const copyBtn = document.getElementById("scanner-copy-btn");
  const saveBtn = document.getElementById("scanner-save-btn");
  const againBtn = document.getElementById("scanner-again-btn");
  const settingsBtn = document.getElementById("scanner-settings-btn");
  const savePdfBtn = document.getElementById("document-save-pdf-btn");
  const saveJpgBtn = document.getElementById("document-save-jpg-btn");
  const savePngBtn = document.getElementById("document-save-png-btn");
  const modeButtons = $$(".scanner-mode-btn");
  const cornerButtons = $$(".doc-corner");
  if (!textInput || !imageEl || !scanBtn || !closeBtn || !torchBtn || !captureBtn || !retakeBtn || !useBtn || !videoEl || !previewCanvas || !cornerEditor || !statusEl || !resultEl || !pageCountEl) return;

  let scannerStream = null;
  let scannerMode = "document";
  let detector = null;
  let scanning = false;
  let torchOn = false;
  let lastScannedValue = "";
  let capturedCanvas = null;
  let documentPages = [];
  let corners = {
    tl: { x: 0.08, y: 0.08 },
    tr: { x: 0.92, y: 0.08 },
    br: { x: 0.92, y: 0.92 },
    bl: { x: 0.08, y: 0.92 },
  };

  function stopScanner() {
    scanning = false;
    if (scannerStream) {
      scannerStream.getTracks().forEach((track) => track.stop());
      scannerStream = null;
    }
    videoEl.pause();
    videoEl.removeAttribute("srcObject");
    videoEl.srcObject = null;
    scanBtn.textContent = "Start Scanner";
    closeBtn.hidden = true;
    torchBtn.hidden = true;
    captureBtn.hidden = true;
    torchOn = false;
  }

  function updateQrCode() {
    const text = textInput.value.trim();
    if (!text) {
      imageEl.removeAttribute("src");
      imageEl.alt = "";
      return;
    }

    imageEl.src = createQrCodeUrl(text);
    imageEl.alt = `QR code for ${text}`;
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function setMode(mode) {
    scannerMode = mode;
    modeButtons.forEach((button) => {
      const active = button.dataset.scannerMode === mode;
      button.classList.toggle("scanner-mode-btn--active", active);
    });
    setStatus("Scanner ready");
  }

  function isUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  function setCodeActions(value) {
    lastScannedValue = value;
    openLinkBtn.hidden = !isUrl(value);
    copyBtn.hidden = false;
    saveBtn.hidden = false;
    againBtn.hidden = false;
  }

  function clearCodeActions() {
    openLinkBtn.hidden = true;
    copyBtn.hidden = true;
    saveBtn.hidden = true;
    againBtn.hidden = true;
    settingsBtn.hidden = true;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  function drawImprovedCrop(sourceCanvas, targetCanvas, crop) {
    const ctx = targetCanvas.getContext("2d");
    targetCanvas.width = Math.max(1, Math.round(crop.width));
    targetCanvas.height = Math.max(1, Math.round(crop.height));
    ctx.filter = "brightness(1.08) contrast(1.18) saturate(0.96)";
    ctx.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, targetCanvas.width, targetCanvas.height);
    ctx.filter = "none";
  }

  function updateCornerButtons() {
    const rect = previewCanvas.getBoundingClientRect();
    cornerButtons.forEach((button) => {
      const corner = corners[button.dataset.corner];
      button.style.left = `${corner.x * rect.width - 12}px`;
      button.style.top = `${corner.y * rect.height - 12}px`;
    });
  }

  function detectDocumentCorners(canvas) {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const sample = ctx.getImageData(0, 0, width, height).data;
    let minX = width * 0.08;
    let minY = height * 0.08;
    let maxX = width * 0.92;
    let maxY = height * 0.92;
    let found = false;

    for (let y = 0; y < height; y += 6) {
      for (let x = 0; x < width; x += 6) {
        const index = (y * width + x) * 4;
        const brightness = (sample[index] + sample[index + 1] + sample[index + 2]) / 3;
        if (brightness > 95) {
          minX = found ? Math.min(minX, x) : x;
          minY = found ? Math.min(minY, y) : y;
          maxX = found ? Math.max(maxX, x) : x;
          maxY = found ? Math.max(maxY, y) : y;
          found = true;
        }
      }
    }

    corners = {
      tl: { x: minX / width, y: minY / height },
      tr: { x: maxX / width, y: minY / height },
      br: { x: maxX / width, y: maxY / height },
      bl: { x: minX / width, y: maxY / height },
    };
  }

  function getCornerCrop(canvas) {
    const xs = Object.values(corners).map((corner) => corner.x * canvas.width);
    const ys = Object.values(corners).map((corner) => corner.y * canvas.height);
    const x = Math.max(0, Math.min(...xs));
    const y = Math.max(0, Math.min(...ys));
    const width = Math.min(canvas.width - x, Math.max(...xs) - x);
    const height = Math.min(canvas.height - y, Math.max(...ys) - y);
    return { x, y, width, height };
  }

  function captureVideoFrame() {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    canvas.getContext("2d").drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function showDocumentPreview(sourceCanvas) {
    capturedCanvas = sourceCanvas;
    previewCanvas.width = sourceCanvas.width;
    previewCanvas.height = sourceCanvas.height;
    previewCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0);
    detectDocumentCorners(sourceCanvas);
    videoEl.hidden = true;
    previewCanvas.hidden = false;
    cornerEditor.hidden = false;
    retakeBtn.hidden = false;
    useBtn.hidden = false;
    captureBtn.hidden = true;
    setStatus("Scan completed");
    requestAnimationFrame(updateCornerButtons);
  }

  async function ensureCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera scanning is not supported in this browser.");
    }

    setStatus("Preparing scanner...");
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    videoEl.srcObject = scannerStream;
    await videoEl.play();
    closeBtn.hidden = false;
    torchBtn.hidden = false;
    setStatus("Scanner ready");
  }

  async function toggleTorch() {
    const track = scannerStream?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.();
    if (!track || !capabilities?.torch) {
      setStatus("Flashlight is not available on this device.");
      return;
    }

    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    torchBtn.textContent = torchOn ? "Flashlight Off" : "Flashlight";
  }

  async function scanCodes() {
    if (!("BarcodeDetector" in window)) {
      setStatus("Scanning is not supported here. Try Chrome on Android, or use document capture as a web fallback.");
      return;
    }

    const formats = scannerMode === "qr"
      ? ["qr_code"]
      : ["aztec", "code_128", "code_39", "code_93", "codabar", "data_matrix", "ean_13", "ean_8", "itf", "pdf417", "qr_code", "upc_a", "upc_e"];
    detector = new BarcodeDetector({ formats });
    scanning = true;
    setStatus("Scanning...");

    const scan = async () => {
      if (!scanning || !scannerStream) return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes.length) {
          const value = codes[0].rawValue;
          resultEl.textContent = value;
          setStatus("Scan completed");
          setCodeActions(value);
          stopScanner();
          return;
        }
      } catch (err) {
        setStatus("Scanning failed. Please try again with better light and a steady camera.");
      }
      requestAnimationFrame(scan);
    };
    scan();
  }

  async function startScanner() {
    if (scannerStream) {
      stopScanner();
      return;
    }

    try {
      clearCodeActions();
      resultEl.textContent = "—";
      previewCanvas.hidden = true;
      cornerEditor.hidden = true;
      videoEl.hidden = false;
      await ensureCamera();
      scanBtn.textContent = "Stop Scanner";
      if (scannerMode === "document") {
        captureBtn.hidden = false;
        setStatus("Scanner ready");
      } else {
        scanCodes();
      }
    } catch (err) {
      const denied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
      setStatus(denied ? "Camera permission was denied. Allow camera access in your browser settings and try again." : err.message || "Camera access was not available.");
      settingsBtn.hidden = false;
      stopScanner();
    }
  }

  function retakeDocument() {
    previewCanvas.hidden = true;
    cornerEditor.hidden = true;
    retakeBtn.hidden = true;
    useBtn.hidden = true;
    videoEl.hidden = false;
    captureBtn.hidden = !scannerStream;
    setStatus(scannerStream ? "Scanner ready" : "Scanner ready");
  }

  function useDocumentScan() {
    if (!capturedCanvas) return;
    const pageCanvas = document.createElement("canvas");
    drawImprovedCrop(capturedCanvas, pageCanvas, getCornerCrop(capturedCanvas));
    documentPages.push(pageCanvas);
    pageCountEl.textContent = String(documentPages.length);
    resultEl.textContent = `${documentPages.length} page${documentPages.length === 1 ? "" : "s"} ready`;
    savePdfBtn.hidden = false;
    saveJpgBtn.hidden = false;
    savePngBtn.hidden = false;
    retakeDocument();
  }

  async function saveDocumentImage(type) {
    const canvas = documentPages[documentPages.length - 1];
    if (!canvas) return;
    const blob = await canvasToBlob(canvas, type === "jpg" ? "image/jpeg" : "image/png");
    downloadBlob(blob, `scan.${type === "jpg" ? "jpg" : "png"}`);
  }

  async function savePdf() {
    if (!documentPages.length) return;
    const encoder = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let byteLength = 0;
    const add = (part) => {
      const chunk = typeof part === "string" ? encoder.encode(part) : part;
      chunks.push(chunk);
      byteLength += chunk.byteLength;
    };
    const addObject = (id, bodyParts) => {
      offsets[id] = byteLength;
      add(`${id} 0 obj\n`);
      bodyParts.forEach(add);
      add("\nendobj\n");
    };

    const imageBuffers = await Promise.all(documentPages.map((canvas) => canvasToBlob(canvas, "image/jpeg", 0.86).then((blob) => blob.arrayBuffer())));
    const pageIds = [];
    let objectId = 3;

    add("%PDF-1.3\n");
    const imageObjects = [];
    const contentObjects = [];
    documentPages.forEach((canvas, index) => {
      const imageId = objectId++;
      const contentId = objectId++;
      const pageId = objectId++;
      imageObjects.push(imageId);
      contentObjects.push(contentId);
      pageIds.push(pageId);

      const imageBytes = new Uint8Array(imageBuffers[index]);
      addObject(imageId, [
        `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.byteLength} >>\nstream\n`,
        imageBytes,
        "\nendstream",
      ]);

      const content = `q\n${canvas.width} 0 0 ${canvas.height} 0 0 cm\n/Im${index} Do\nQ`;
      addObject(contentId, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
      addObject(pageId, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${canvas.width} ${canvas.height}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
    });

    addObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    addObject(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`]);

    const xrefOffset = byteLength;
    add(`xref\n0 ${objectId}\n0000000000 65535 f \n`);
    for (let id = 1; id < objectId; id += 1) {
      add(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    }
    add(`trailer\n<< /Size ${objectId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    downloadBlob(new Blob(chunks, { type: "application/pdf" }), "scan.pdf");
  }

  textInput.value = "https://rimalsuman-cyber.github.io/converter/";
  textInput.addEventListener("input", updateQrCode);
  modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.scannerMode)));
  scanBtn.addEventListener("click", startScanner);
  closeBtn.addEventListener("click", stopScanner);
  torchBtn.addEventListener("click", toggleTorch);
  captureBtn.addEventListener("click", () => showDocumentPreview(captureVideoFrame()));
  retakeBtn.addEventListener("click", retakeDocument);
  useBtn.addEventListener("click", useDocumentScan);
  againBtn.addEventListener("click", startScanner);
  openLinkBtn.addEventListener("click", () => window.open(lastScannedValue, "_blank", "noopener"));
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(lastScannedValue);
    setStatus("Scan copied");
  });
  saveBtn.addEventListener("click", () => downloadBlob(new Blob([lastScannedValue], { type: "text/plain" }), "scan-result.txt"));
  settingsBtn.addEventListener("click", () => setStatus("Open your browser or phone settings, allow camera access for this site, then return and tap Start Scanner."));
  savePdfBtn.addEventListener("click", savePdf);
  saveJpgBtn.addEventListener("click", () => saveDocumentImage("jpg"));
  savePngBtn.addEventListener("click", () => saveDocumentImage("png"));
  cornerButtons.forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointermove", (event) => {
      if (!button.hasPointerCapture(event.pointerId)) return;
      const rect = previewCanvas.getBoundingClientRect();
      corners[button.dataset.corner] = {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      };
      updateCornerButtons();
    });
  });
  updateQrCode();
}

/* ---------- 17. GST / VAT CALCULATOR ---------- */

function setupTaxCalculator() {
  const amountInput = document.getElementById("tax-amount-input");
  const rateInput = document.getElementById("tax-rate-input");
  const modeSelect = document.getElementById("tax-mode-select");
  const netEl = document.getElementById("tax-net-result");
  const taxEl = document.getElementById("tax-value-result");
  const totalEl = document.getElementById("tax-total-result");
  if (!amountInput || !rateInput || !modeSelect || !netEl || !taxEl || !totalEl) return;

  function updateResult() {
    const amount = parseFloat(amountInput.value);
    const rate = parseFloat(rateInput.value);

    if (isNaN(amount) || isNaN(rate)) {
      netEl.textContent = "—";
      taxEl.textContent = "—";
      totalEl.textContent = "—";
      return;
    }

    const result = calculateTax(amount, rate, modeSelect.value);
    netEl.textContent = roundTo(result.net);
    taxEl.textContent = roundTo(result.tax);
    totalEl.textContent = roundTo(result.total);
  }

  amountInput.value = "1000";
  rateInput.value = "18";
  amountInput.addEventListener("input", updateResult);
  rateInput.addEventListener("input", updateResult);
  modeSelect.addEventListener("change", updateResult);
  updateResult();
}

/* ---------- 18. PERCENTAGE CALCULATOR ---------- */

function setupPercentageCalculator() {
  const baseInput = document.getElementById("percentage-base-input");
  const percentInput = document.getElementById("percentage-value-input");
  const modeSelect = document.getElementById("percentage-mode-select");
  const resultEl = document.getElementById("percentage-result");
  if (!baseInput || !percentInput || !modeSelect || !resultEl) return;

  function updateResult() {
    const base = parseFloat(baseInput.value);
    const percent = parseFloat(percentInput.value);

    if (isNaN(base) || isNaN(percent)) {
      resultEl.textContent = "—";
      return;
    }

    const result = calculatePercentage(base, percent, modeSelect.value);
    if (modeSelect.value === "increase") {
      resultEl.textContent = `${roundTo(base)} increased by ${roundTo(percent)}% = ${roundTo(result)}`;
    } else if (modeSelect.value === "decrease") {
      resultEl.textContent = `${roundTo(base)} decreased by ${roundTo(percent)}% = ${roundTo(result)}`;
    } else {
      resultEl.textContent = `${roundTo(percent)}% of ${roundTo(base)} = ${roundTo(result)}`;
    }
  }

  baseInput.value = "250";
  percentInput.value = "12";
  baseInput.addEventListener("input", updateResult);
  percentInput.addEventListener("input", updateResult);
  modeSelect.addEventListener("change", updateResult);
  updateResult();
}

/* ---------- 19. AGE CALCULATOR ---------- */

function setupAgeCalculator() {
  const birthInput = document.getElementById("age-birth-input");
  const compareInput = document.getElementById("age-compare-input");
  const yearsEl = document.getElementById("age-years-result");
  const monthsEl = document.getElementById("age-months-result");
  const daysEl = document.getElementById("age-days-result");
  const totalDaysEl = document.getElementById("age-total-days-result");
  if (!birthInput || !compareInput || !yearsEl || !monthsEl || !daysEl || !totalDaysEl) return;

  function setAgeResults(years, months, days, totalDays) {
    yearsEl.textContent = years;
    monthsEl.textContent = months;
    daysEl.textContent = days;
    totalDaysEl.textContent = totalDays;
  }

  function updateResult() {
    const birthDate = new Date(birthInput.value);
    const compareDate = new Date(compareInput.value);

    if (isNaN(birthDate.getTime()) || isNaN(compareDate.getTime()) || birthDate > compareDate) {
      setAgeResults("—", "—", "—", "—");
      return;
    }

    const age = calculateAgeParts(birthDate, compareDate);
    setAgeResults(age.years, age.months, age.days, roundTo(age.totalDays, 0));
  }

  birthInput.value = "2000-01-01";
  compareInput.value = new Date().toISOString().slice(0, 10);
  birthInput.addEventListener("input", updateResult);
  compareInput.addEventListener("input", updateResult);
  updateResult();
}

/* ---------- 20. SETTINGS PAGE EXTRAS ---------- */

function setupSettingsPage() {
  const clearCacheBtn = document.getElementById("clear-cache-btn");
  if (!clearCacheBtn) return;

  clearCacheBtn.addEventListener("click", () => {
    clearCurrencyCache();
    clearCacheBtn.textContent = "Cleared!";
    setTimeout(() => (clearCacheBtn.textContent = "Clear"), 1500);
  });
}

/* ---------- 21. GLOBAL ERROR SAFETY NET ---------- */
/* Catches anything unexpected (a bug we didn't anticipate) so it's
   always visible in the console for debugging, rather than failing
   silently. This doesn't change app behavior — it's a diagnostic
   safety net, which is standard practice in production-quality apps. */

function setupGlobalErrorHandling() {
  window.addEventListener("error", (event) => {
    console.error("[UnitKit] Unhandled error:", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[UnitKit] Unhandled promise rejection:", event.reason);
  });
}

/* ---------- APP INIT ---------- */

function initApp() {
  setupGlobalErrorHandling();
  disablePageZoomGestures();
  setupTheme();
  setupNavigation();
  setupResetButtons();
  setupDistanceConverter();
  setupTemperatureConverter();
  setupWeightConverter();
  setupLengthConverter();
  setupAreaConverter();
  setupVolumeConverter();
  setupSpeedConverter();
  setupCurrencyConverter();
  setupCalculator();
  setupBMICalculator();
  setupTipCalculator();
  setupTimeZoneConverter();
  setupQrTool();
  setupTaxCalculator();
  setupPercentageCalculator();
  setupAgeCalculator();
  setupSettingsPage();
  registerServiceWorker();
}

// Wait for the DOM to be ready before wiring anything up
document.addEventListener("DOMContentLoaded", initApp);
