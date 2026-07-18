/* =========================================================
   currency.js
   Handles fetching + caching live currency exchange rates.
   Single responsibility: get rate data. Formatting and storage
   plumbing are delegated to js/utils/, keeping this file focused.

   Data source: ExchangeRate-API's free, keyless, open-access
   endpoint (https://open.er-api.com). Chosen over Frankfurter
   because Frankfurter's ECB data source does not include NPR
   (Nepalese Rupee), which this app requires.

   Caching strategy:
     - Rates are cached in localStorage per base currency.
     - Cache is considered "fresh" for CURRENCY_CACHE_TTL_MS —
       matches how often the underlying data actually updates,
       and avoids hammering the free API.
     - If a fetch fails (offline, API down, timeout) we fall
       back to whatever is cached, however old it is, so the
       app still works offline. If there's no cache at all, we
       throw so app.js can show a friendly error message.
========================================================= */

import {
  CURRENCY_API_BASE_URL,
  CURRENCY_CACHE_PREFIX,
  CURRENCY_CACHE_TTL_MS,
  CURRENCY_FETCH_TIMEOUT_MS,
} from "../config/constants.js";
import { readJSON, writeJSON, removeByPrefix } from "../utils/storage.js";

/**
 * Fetches fresh exchange rates from the API for a given base currency.
 * Aborts automatically if the request takes too long, so a hung
 * connection can't leave the UI stuck on "Fetching latest rates…" forever.
 * @param {string} baseCurrency e.g. "CHF"
 * @returns {Promise<object>} rates map, e.g. { USD: 1.1, INR: 91.2, ... }
 */
async function fetchRatesFromApi(baseCurrency) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CURRENCY_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${CURRENCY_API_BASE_URL}/${baseCurrency}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Currency API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (data.result !== "success" || !data.rates) {
      throw new Error("Currency API returned an unexpected response");
    }

    return data.rates;
  } catch (err) {
    // Give a clearer message for the common "request timed out" case
    if (err.name === "AbortError") {
      throw new Error("Currency API request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Gets rates for a base currency, using the cache when it's still fresh,
 * fetching new data when needed, and falling back to stale cache on error.
 *
 * @param {string} baseCurrency
 * @param {boolean} forceRefresh - skip the cache and hit the network
 * @returns {Promise<{rates: object, lastUpdated: number, fromCache: boolean}>}
 */
async function getRates(baseCurrency, forceRefresh = false) {
  const cacheKey = CURRENCY_CACHE_PREFIX + baseCurrency;
  const cached = readJSON(cacheKey);
  const cacheIsFresh = cached && Date.now() - cached.timestamp < CURRENCY_CACHE_TTL_MS;

  // Use fresh cache immediately — no need to hit the network
  if (cacheIsFresh && !forceRefresh) {
    return { rates: cached.rates, lastUpdated: cached.timestamp, fromCache: true };
  }

  // Otherwise, try to fetch new data
  try {
    const rates = await fetchRatesFromApi(baseCurrency);
    const timestamp = Date.now();
    writeJSON(cacheKey, { rates, timestamp });
    return { rates, lastUpdated: timestamp, fromCache: false };
  } catch (networkError) {
    // Network/API failed — fall back to whatever cache we have, even if stale
    if (cached) {
      console.warn("[UnitKit] Using stale cached rates due to fetch error:", networkError);
      return { rates: cached.rates, lastUpdated: cached.timestamp, fromCache: true };
    }
    // No cache at all — nothing we can do, let the caller handle the error
    throw networkError;
  }
}

/**
 * Public function used by app.js: gets the exchange rate between
 * two currencies (via a shared base currency fetch + cache).
 *
 * @param {string} fromCurrency e.g. "CHF"
 * @param {string} toCurrency e.g. "NPR"
 * @param {boolean} forceRefresh
 * @returns {Promise<{rate: number, lastUpdated: number, fromCache: boolean}>}
 */
export async function getExchangeRate(fromCurrency, toCurrency, forceRefresh = false) {
  const { rates, lastUpdated, fromCache } = await getRates(fromCurrency, forceRefresh);

  const rate = rates[toCurrency];
  if (typeof rate !== "number") {
    throw new Error(`No exchange rate found for ${fromCurrency} -> ${toCurrency}`);
  }

  return { rate, lastUpdated, fromCache };
}

/**
 * Clears all cached currency rates from localStorage.
 * Used by the Settings page "Clear cache" button.
 */
export function clearCurrencyCache() {
  removeByPrefix(CURRENCY_CACHE_PREFIX);
}
