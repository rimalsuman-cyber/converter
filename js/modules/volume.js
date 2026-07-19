/* =========================================================
   volume.js
   Pure conversion functions for Volume.
   Same pattern as the other modules — plain, testable, no DOM.
========================================================= */

// 1 liter = 0.264172 US gallons
const LITER_TO_GALLON_FACTOR = 0.264172;

/**
 * Converts liters to US gallons.
 * @param {number} liters
 * @returns {number} volume in US gallons
 */
export function litersToGallons(liters) {
  return liters * LITER_TO_GALLON_FACTOR;
}

/**
 * Converts US gallons to liters.
 * @param {number} gallons
 * @returns {number} volume in liters
 */
export function gallonsToLiters(gallons) {
  return gallons / LITER_TO_GALLON_FACTOR;
}
