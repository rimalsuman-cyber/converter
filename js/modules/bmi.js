/* =========================================================
   bmi.js
   Pure functions for BMI (Body Mass Index) calculation.
   Same pattern as the other modules — plain, testable, no DOM.
========================================================= */

// Standard WHO BMI category thresholds (kg/m²).
// Exported so the UI layer can label results without hardcoding
// these numbers a second time anywhere else.
export const BMI_CATEGORIES = [
  { max: 18.5, label: "Underweight" },
  { max: 25, label: "Normal weight" },
  { max: 30, label: "Overweight" },
  { max: Infinity, label: "Obese" },
];

/**
 * Calculates Body Mass Index from weight and height.
 * Formula: BMI = weight(kg) / height(m)^2
 * @param {number} weightKg - weight in kilograms
 * @param {number} heightCm - height in centimeters
 * @returns {number} BMI value (kg/m²)
 */
export function calculateBMI(weightKg, heightCm) {
  const heightM = heightCm / 100;
  if (heightM <= 0) return NaN;
  return weightKg / (heightM * heightM);
}

/**
 * Maps a BMI value to its WHO weight-status category label.
 * @param {number} bmi
 * @returns {string} category label, e.g. "Normal weight"
 */
export function getBMICategory(bmi) {
  const category = BMI_CATEGORIES.find((entry) => bmi < entry.max);
  return category ? category.label : "Unknown";
}
