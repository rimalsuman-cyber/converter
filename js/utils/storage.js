/* =========================================================
   storage.js
   Safe wrappers around localStorage.

   Why: localStorage can throw in some situations (Safari
   private browsing, storage quota exceeded, browser settings
   that disable it entirely). Previously that try/catch logic
   was duplicated in app.js (theme) and currency.js (rate
   cache). Centralizing it here means every feature that reads
   or writes localStorage automatically gets the same safe,
   non-crashing behavior — and if we ever swap storage engines
   (e.g. to IndexedDB), there's exactly one place to change.
========================================================= */

/**
 * Reads and JSON-parses a value from localStorage.
 * @param {string} key
 * @returns {any | null} parsed value, or null if missing/invalid
 */
export function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`[UnitKit] Failed to read "${key}" from storage:`, err);
    return null;
  }
}

/**
 * JSON-stringifies and writes a value to localStorage.
 * @param {string} key
 * @param {any} value
 * @returns {boolean} true if the write succeeded
 */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[UnitKit] Failed to write "${key}" to storage:`, err);
    return false;
  }
}

/**
 * Reads a plain (non-JSON) string value from localStorage.
 * @param {string} key
 * @returns {string | null}
 */
export function readString(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[UnitKit] Failed to read "${key}" from storage:`, err);
    return null;
  }
}

/**
 * Writes a plain string value to localStorage.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} true if the write succeeded
 */
export function writeString(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[UnitKit] Failed to write "${key}" to storage:`, err);
    return false;
  }
}

/**
 * Removes every key that starts with the given prefix.
 * Used to clear all cached currency rates in one call, regardless
 * of how many base currencies have been cached.
 * @param {string} prefix
 */
export function removeByPrefix(prefix) {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.warn(`[UnitKit] Failed to clear keys with prefix "${prefix}":`, err);
  }
}
