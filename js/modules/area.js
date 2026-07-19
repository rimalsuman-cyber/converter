/* =========================================================
   area.js
   Pure conversion functions for Area.
   Same pattern as the other modules — plain, testable, no DOM.
========================================================= */

// 1 square meter = 10.7639 square feet
const SQ_METER_TO_SQ_FEET_FACTOR = 10.7639;

/**
 * Converts square meters to square feet.
 * @param {number} sqMeters
 * @returns {number} area in square feet
 */
export function sqMetersToSqFeet(sqMeters) {
  return sqMeters * SQ_METER_TO_SQ_FEET_FACTOR;
}

/**
 * Converts square feet to square meters.
 * @param {number} sqFeet
 * @returns {number} area in square meters
 */
export function sqFeetToSqMeters(sqFeet) {
  return sqFeet / SQ_METER_TO_SQ_FEET_FACTOR;
}
