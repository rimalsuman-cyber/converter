/* =========================================================
   constants.js
   Single source of truth for values shared across modules.

   Why this file exists (senior-level rationale):
   Before this refactor, values like storage keys, timeouts,
   and page titles were hardcoded inline wherever they were
   used. That's fragile — e.g. renaming a localStorage key
   meant hunting through multiple files, and a typo in one
   spot silently breaks a feature with no error.
   Centralizing them here means:
     - One place to change a value
     - Typos become import errors, not silent bugs
     - Easy to see the app's full "configuration surface"
========================================================= */

/* ---------- Theme ---------- */
export const THEME_STORAGE_KEY = "unitkit-theme";

/* ---------- Currency API ---------- */
export const CURRENCY_API_BASE_URL = "https://open.er-api.com/v6/latest";
export const CURRENCY_CACHE_PREFIX = "unitkit-currency-cache-";
export const CURRENCY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const CURRENCY_FETCH_TIMEOUT_MS = 8000; // abort slow requests after 8s
export const CURRENCY_BASE_CODE = "CHF";

/* Debounce delay for the currency amount input, so rapid typing
   doesn't trigger a recalculation on every single keystroke. */
export const CURRENCY_INPUT_DEBOUNCE_MS = 250;

/* ---------- Page titles ----------
   Maps each <section id="..."> to the text shown in the header
   when that page is active. Adding a future page (e.g. Weight
   converter) just means adding one line here. */
export const PAGE_TITLES = {
  "page-home": "UnitKit",
  "page-distance": "Distance",
  "page-temperature": "Temperature",
  "page-currency": "Currency",
  "page-weight": "Weight",
  "page-calculator": "Calculator",
  "page-bmi": "BMI Calculator",
  "page-length": "Length",
  "page-area": "Area",
  "page-volume": "Volume",
  "page-speed": "Speed",
  "page-tip": "Tip Calculator",
  "page-settings": "Settings",
  "page-about": "About",
};

export const DEFAULT_PAGE_ID = "page-home";

/* ---------- Tip Calculator ----------
   Keep these in sync with the preset buttons in index.html's
   Tip Calculator page (data-tip-percent attributes). */
export const TIP_PRESET_PERCENTAGES = [10, 15, 20, 25];
export const TIP_DEFAULT_PERCENT = 20;
