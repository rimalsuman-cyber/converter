/* =========================================================
   length.js
   Pure conversion functions for Length (everyday/short-range
   measurements — distinct from Distance, which covers longer
   travel-scale km/mile conversions).
   Same pattern as the other modules — plain, testable, no DOM.
========================================================= */

// 1 meter = 3.28084 feet
const METER_TO_FEET_FACTOR = 3.28084;

/**
 * Converts meters to feet.
 * @param {number} meters
 * @returns {number} length in feet
 */
export function metersToFeet(meters) {
  return meters * METER_TO_FEET_FACTOR;
}

/**
 * Converts feet to meters.
 * @param {number} feet
 * @returns {number} length in meters
 */
export function feetToMeters(feet) {
  return feet / METER_TO_FEET_FACTOR;
}
