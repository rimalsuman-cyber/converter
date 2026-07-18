/* =========================================================
   weight.js
   Pure conversion functions for Weight.
   Same pattern as distance.js / temperature.js — plain,
   testable, reusable, no DOM code.
========================================================= */

// 1 kilogram = 2.20462262185 pounds
const KG_TO_LB_FACTOR = 2.20462262185;

/**
 * Converts kilograms to pounds.
 * @param {number} kg - weight in kilograms
 * @returns {number} weight in pounds
 */
export function kgToLbs(kg) {
  return kg * KG_TO_LB_FACTOR;
}

/**
 * Converts pounds to kilograms.
 * @param {number} lbs - weight in pounds
 * @returns {number} weight in kilograms
 */
export function lbsToKg(lbs) {
  return lbs / KG_TO_LB_FACTOR;
}
