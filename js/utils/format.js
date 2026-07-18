/* =========================================================
   format.js
   Shared, presentation-only formatting helpers.

   Why: `roundResult()` lived in app.js and was fine there, but
   `formatRelativeTime()` (previously `getLastUpdatedText`) lived
   inside currency.js even though it has nothing to do with
   fetching or caching rates — it's pure display formatting.
   Moving it here keeps currency.js focused on ONE job (getting
   exchange rate data) and makes the formatter reusable by any
   future feature that shows a timestamp (e.g. a future "last
   synced" indicator elsewhere in the app).
========================================================= */

/**
 * Rounds a number to a fixed number of decimal places for clean
 * display (avoids floating-point artifacts like 12.000000004).
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {number}
 */
export function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Formats a timestamp into a short, human-friendly "time ago"
 * string, e.g. "just now", "5 min ago", "3h ago", or a date
 * once it's more than a day old.
 * @param {number} timestamp - milliseconds since epoch
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "just now";

  const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);

  if (secondsAgo < 10) return "just now";
  if (secondsAgo < 60) return `${secondsAgo}s ago`;

  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `${minutesAgo} min ago`;

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;

  return new Date(timestamp).toLocaleDateString();
}
