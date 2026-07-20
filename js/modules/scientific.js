const ALLOWED_WORDS = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "log",
  "log10",
  "ln",
  "abs",
  "floor",
  "ceil",
  "round",
  "pi",
  "e",
]);

export function calculateScientificExpression(expression) {
  const words = expression.match(/[A-Za-z_]+/g) || [];
  if (words.some((word) => !ALLOWED_WORDS.has(word.toLowerCase()))) {
    throw new Error("Unsupported function");
  }

  const normalized = expression
    .replace(/\^/g, "**")
    .replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|log10|log|ln|abs|floor|ceil|round)\b/g, "Math.$1")
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/\be\b/g, "Math.E")
    .replace(/Math\.ln/g, "Math.log");

  if (!/^[\d+\-*/().,\s%*A-Za-z_]+$/.test(normalized)) {
    throw new Error("Unsupported characters");
  }

  const value = Function(`"use strict"; return (${normalized});`)();
  if (!Number.isFinite(value)) {
    throw new Error("Invalid result");
  }

  return value;
}
