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
  CURRENCY_BASE_CODE,
  CURRENCY_INPUT_DEBOUNCE_MS,
  TIP_DEFAULT_PERCENT,
} from "./config/constants.js";

/* ---------- 1. SERVICE WORKER REGISTRATION ---------- */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
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

  const themeIcon = document.getElementById("theme-icon");
  if (themeIcon) themeIcon.textContent = isDark ? "☀️" : "🌙";

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

  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const darkModeSwitch = document.getElementById("dark-mode-switch");
  themeToggleBtn?.addEventListener("click", toggleTheme);
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
  const targetSelect = document.getElementById("currency-target-select");
  const resultEl = document.getElementById("currency-result");
  const statusEl = document.getElementById("currency-status");
  const refreshBtn = document.getElementById("currency-refresh-btn");
  if (!amountInput || !targetSelect || !resultEl || !statusEl || !refreshBtn) return;

  const statusRow = statusEl.closest(".status-row");

  /**
   * Re-calculates and displays the converted amount using
   * whatever rates are currently cached in the currency module.
   */
  async function updateResult({ forceRefresh = false } = {}) {
    const amount = parseFloat(amountInput.value) || 0;
    const targetCurrency = targetSelect.value;

    statusEl.textContent = "Fetching latest rates…";
    statusRow?.classList.remove("error");

    try {
      const { rate, lastUpdated, fromCache } = await getExchangeRate(
        CURRENCY_BASE_CODE,
        targetCurrency,
        forceRefresh
      );

      const converted = amount * rate;
      resultEl.textContent = `${amount || 0} ${CURRENCY_BASE_CODE} = ${roundTo(converted)} ${targetCurrency}`;

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
  targetSelect.addEventListener("change", () => updateResult());
  refreshBtn.addEventListener("click", () => updateResult({ forceRefresh: true }));

  // Load rates as soon as the app starts
  updateResult();
}

/* ---------- 12. CALCULATOR ---------- */

function setupCalculator() {
  const displayEl = document.getElementById("calculator-display");
  const calculatorCard = displayEl?.closest(".calculator-card");
  if (!displayEl || !calculatorCard) return;

  const engine = createCalculatorEngine();

  function render() {
    displayEl.textContent = engine.getDisplay();
  }

  // Single delegated listener on the button grid, instead of one
  // listener per button — less code, and automatically covers any
  // buttons added to the grid later.
  calculatorCard.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const { calcDigit, calcOperator, calcAction } = button.dataset;

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
    if (!isCalculatorOpen) return;

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

  render();
}

/* ---------- 13. BMI CALCULATOR ---------- */

function setupBMICalculator() {
  const weightInput = document.getElementById("bmi-weight-input");
  const heightInput = document.getElementById("bmi-height-input");
  const resultEl = document.getElementById("bmi-result");
  const categoryEl = document.getElementById("bmi-category");
  if (!weightInput || !heightInput || !resultEl || !categoryEl) return;

  function updateResult() {
    const weightKg = parseFloat(weightInput.value);
    const heightCm = parseFloat(heightInput.value);

    if (isNaN(weightKg) || isNaN(heightCm) || weightKg <= 0 || heightCm <= 0) {
      resultEl.textContent = "—";
      categoryEl.textContent = "";
      return;
    }

    const bmi = calculateBMI(weightKg, heightCm);
    resultEl.textContent = `BMI: ${roundTo(bmi, 1)}`;
    categoryEl.textContent = getBMICategory(bmi);
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
  toSelect.value = "Asia/Kolkata";

  function updateResult() {
    if (!dateTimeInput.value) {
      resultEl.textContent = "—";
      return;
    }

    const sourceDate = dateFromZoneInput(dateTimeInput.value, fromSelect.value);
    resultEl.textContent = `${formatInZone(sourceDate, fromSelect.value)} ${fromSelect.value} = ${formatInZone(sourceDate, toSelect.value)} ${toSelect.value}`;
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
  const videoEl = document.getElementById("qr-video");
  const resultEl = document.getElementById("qr-scan-result");
  if (!textInput || !imageEl || !scanBtn || !videoEl || !resultEl) return;

  let qrStream = null;

  function stopScanner() {
    if (!qrStream) return;
    qrStream.getTracks().forEach((track) => track.stop());
    qrStream = null;
    scanBtn.textContent = "Start scanner";
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

  async function startScanner() {
    if (qrStream) {
      stopScanner();
      return;
    }

    if (!canScanQrCodes()) {
      resultEl.textContent = "QR scanning is not supported in this browser.";
      return;
    }

    try {
      qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoEl.srcObject = qrStream;
      await videoEl.play();
      scanBtn.textContent = "Stop scanner";

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!qrStream) return;

        const codes = await detector.detect(videoEl);
        if (codes.length) {
          resultEl.textContent = codes[0].rawValue;
          stopScanner();
          return;
        }

        requestAnimationFrame(scan);
      };

      scan();
    } catch (err) {
      resultEl.textContent = "Camera access was not available.";
      stopScanner();
    }
  }

  textInput.value = "https://rimalsuman-cyber.github.io/converter/";
  textInput.addEventListener("input", updateQrCode);
  scanBtn.addEventListener("click", startScanner);
  updateQrCode();
}

/* ---------- 17. SCIENTIFIC CALCULATOR ---------- */

function setupScientificCalculator() {
  const expressionInput = document.getElementById("scientific-expression-input");
  const resultEl = document.getElementById("scientific-result");
  if (!expressionInput || !resultEl) return;

  function updateResult() {
    const expression = expressionInput.value.trim();
    if (!expression) {
      resultEl.textContent = "—";
      return;
    }

    try {
      resultEl.textContent = roundTo(calculateScientificExpression(expression), 8);
    } catch (err) {
      resultEl.textContent = "Invalid expression";
    }
  }

  expressionInput.value = "sin(pi / 2) + sqrt(144)";
  expressionInput.addEventListener("input", updateResult);
  updateResult();
}

/* ---------- 18. GST / VAT CALCULATOR ---------- */

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

/* ---------- 19. PERCENTAGE CALCULATOR ---------- */

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

/* ---------- 20. AGE CALCULATOR ---------- */

function setupAgeCalculator() {
  const birthInput = document.getElementById("age-birth-input");
  const compareInput = document.getElementById("age-compare-input");
  const resultEl = document.getElementById("age-result");
  if (!birthInput || !compareInput || !resultEl) return;

  function updateResult() {
    const birthDate = new Date(birthInput.value);
    const compareDate = new Date(compareInput.value);

    if (isNaN(birthDate.getTime()) || isNaN(compareDate.getTime()) || birthDate > compareDate) {
      resultEl.textContent = "Choose valid dates";
      return;
    }

    const age = calculateAgeParts(birthDate, compareDate);
    resultEl.textContent = `${age.years} years, ${age.months} months, ${age.days} days (${roundTo(age.totalDays, 0)} days)`;
  }

  birthInput.value = "2000-01-01";
  compareInput.value = new Date().toISOString().slice(0, 10);
  birthInput.addEventListener("input", updateResult);
  compareInput.addEventListener("input", updateResult);
  updateResult();
}

/* ---------- 21. SETTINGS PAGE EXTRAS ---------- */

function setupSettingsPage() {
  const clearCacheBtn = document.getElementById("clear-cache-btn");
  if (!clearCacheBtn) return;

  clearCacheBtn.addEventListener("click", () => {
    clearCurrencyCache();
    clearCacheBtn.textContent = "Cleared!";
    setTimeout(() => (clearCacheBtn.textContent = "Clear"), 1500);
  });
}

/* ---------- 22. GLOBAL ERROR SAFETY NET ---------- */
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
  setupScientificCalculator();
  setupTaxCalculator();
  setupPercentageCalculator();
  setupAgeCalculator();
  setupSettingsPage();
  registerServiceWorker();
}

// Wait for the DOM to be ready before wiring anything up
document.addEventListener("DOMContentLoaded", initApp);
