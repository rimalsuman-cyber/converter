/* =========================================================
   temperature.js
   Pure conversion functions for Temperature.
   Same pattern as distance.js — plain, testable, reusable.
========================================================= */

/**
 * Converts Celsius to Fahrenheit.
 * Formula: F = (C x 9/5) + 32
 * @param {number} celsius
 * @returns {number} temperature in Fahrenheit
 */
export function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

/**
 * Converts Fahrenheit to Celsius.
 * Formula: C = (F - 32) x 5/9
 * @param {number} fahrenheit
 * @returns {number} temperature in Celsius
 */
export function fahrenheitToCelsius(fahrenheit) {
  return ((fahrenheit - 32) * 5) / 9;
}
