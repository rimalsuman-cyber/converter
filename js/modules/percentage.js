export function calculatePercentage(base, percent, mode) {
  if (mode === "increase") {
    return base * (1 + percent / 100);
  }

  if (mode === "decrease") {
    return base * (1 - percent / 100);
  }

  return base * percent / 100;
}
