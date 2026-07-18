/* =========================================================
   distance.js
   Pure conversion functions for Distance.
   No DOM code here — just math. This makes the functions:
     - Easy to test
     - Easy to reuse anywhere (app.js, future modules, etc.)
   Pattern: every future converter module (weight.js, length.js,
   area.js, volume.js, speed.js...) should follow this same shape —
   plain exported functions, one clear job each.
========================================================= */

// 1 kilometer = 0.621371 miles
const KM_TO_MILE_FACTOR = 0.621371;

/**
 * Converts kilometers to miles.
 * @param {number} km - distance in kilometers
 * @returns {number} distance in miles
 */
export function kmToMiles(km) {
  return km * KM_TO_MILE_FACTOR;
}

/**
 * Converts miles to kilometers.
 * @param {number} miles - distance in miles
 * @returns {number} distance in kilometers
 */
export function milesToKm(miles) {
  return miles / KM_TO_MILE_FACTOR;
}
