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

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
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

/* ---------- 6. CURRENCY CONVERTER ---------- */

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

/* ---------- 7. SETTINGS PAGE EXTRAS ---------- */

function setupSettingsPage() {
  const clearCacheBtn = document.getElementById("clear-cache-btn");
  if (!clearCacheBtn) return;

  clearCacheBtn.addEventListener("click", () => {
    clearCurrencyCache();
    clearCacheBtn.textContent = "Cleared!";
    setTimeout(() => (clearCacheBtn.textContent = "Clear"), 1500);
  });
}

/* ---------- 8. GLOBAL ERROR SAFETY NET ---------- */
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
  setupTheme();
  setupNavigation();
  setupDistanceConverter();
  setupTemperatureConverter();
  setupCurrencyConverter();
  setupSettingsPage();
  registerServiceWorker();
}

// Wait for the DOM to be ready before wiring anything up
document.addEventListener("DOMContentLoaded", initApp);
