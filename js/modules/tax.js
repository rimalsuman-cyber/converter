export function calculateTax(amount, rate, mode) {
  const tax = mode === "exclusive"
    ? amount * rate / 100
    : amount - amount / (1 + rate / 100);

  return {
    net: mode === "exclusive" ? amount : amount - tax,
    tax,
    total: mode === "exclusive" ? amount + tax : amount,
  };
}
