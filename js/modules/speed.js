/* =========================================================
   speed.js
   Pure conversion functions for Speed.
   Same pattern as the other modules — plain, testable, no DOM.
========================================================= */

// 1 km/h = 0.621371 mph (same underlying ratio as km <-> miles)
const KMH_TO_MPH_FACTOR = 0.621371;

/**
 * Converts kilometers per hour to miles per hour.
 * @param {number} kmh
 * @returns {number} speed in mph
 */
export function kmhToMph(kmh) {
  return kmh * KMH_TO_MPH_FACTOR;
}

/**
 * Converts miles per hour to kilometers per hour.
 * @param {number} mph
 * @returns {number} speed in km/h
 */
export function mphToKmh(mph) {
  return mph / KMH_TO_MPH_FACTOR;
}
