/* =========================================================
   tip.js
   Pure functions for Tip Calculator math.
   Same DOM-free philosophy as the other modules.
========================================================= */

/**
 * Calculates the tip amount from a bill total and tip percentage.
 * @param {number} billAmount
 * @param {number} tipPercent - e.g. 20 for 20%
 * @returns {number} tip amount (same currency unit as billAmount)
 */
export function calculateTipAmount(billAmount, tipPercent) {
  return billAmount * (tipPercent / 100);
}

/**
 * Adds the tip to the bill to get the final total.
 * @param {number} billAmount
 * @param {number} tipAmount
 * @returns {number}
 */
export function calculateTotalWithTip(billAmount, tipAmount) {
  return billAmount + tipAmount;
}

/**
 * Splits a total amount evenly across a number of people.
 * @param {number} totalAmount
 * @param {number} numberOfPeople
 * @returns {number} amount owed per person
 */
export function calculatePerPersonShare(totalAmount, numberOfPeople) {
  const people = numberOfPeople > 0 ? numberOfPeople : 1;
  return totalAmount / people;
}
