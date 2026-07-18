/* =========================================================
   calculator.js
   Pure calculator logic, with no DOM code — same philosophy
   as the other conversion modules. app.js only reads the
   current display value and forwards button clicks/key
   presses into these functions.

   Design: createCalculatorEngine() returns a small object that
   holds its own private state (via closures) and exposes methods
   to mutate it. This mirrors how a real four-function calculator
   works internally: a "current entry", a "stored value" from the
   last operator press, and the pending operator itself.
========================================================= */

const MAX_DISPLAY_DIGITS = 12; // guards against unreadable overflow

/**
 * Performs a single arithmetic operation between two numbers.
 * Exported on its own since it's independently useful/testable.
 * @param {number} a
 * @param {string} operator - one of "+", "-", "×", "÷"
 * @param {number} b
 * @returns {number}
 */
export function calculate(a, operator, b) {
  switch (operator) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      if (b === 0) {
        throw new Error("Cannot divide by zero");
      }
      return a / b;
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Creates a new, independent calculator engine instance.
 * @returns {object} engine with methods for every calculator action
 */
export function createCalculatorEngine() {
  let display = "0"; // what's currently shown
  let storedValue = null; // the left-hand operand, once an operator is pressed
  let pendingOperator = null; // "+", "-", "×", "÷", or null
  let overwriteOnNextDigit = true; // true right after an operator/equals/clear
  let hasError = false;

  /** Resets the engine back to its initial state. */
  function clear() {
    display = "0";
    storedValue = null;
    pendingOperator = null;
    overwriteOnNextDigit = true;
    hasError = false;
  }

  /** Appends a digit (0-9) to the display, respecting overwrite mode. */
  function inputDigit(digit) {
    if (hasError) clear();

    if (overwriteOnNextDigit) {
      display = digit;
      overwriteOnNextDigit = false;
      return;
    }

    if (display.replace("-", "").replace(".", "").length >= MAX_DISPLAY_DIGITS) {
      return; // ignore further digits once the display is "full"
    }

    display = display === "0" ? digit : display + digit;
  }

  /** Inserts a decimal point, if the current entry doesn't already have one. */
  function inputDecimal() {
    if (hasError) clear();

    if (overwriteOnNextDigit) {
      display = "0.";
      overwriteOnNextDigit = false;
      return;
    }

    if (!display.includes(".")) {
      display += ".";
    }
  }

  /** Removes the last character typed (for a backspace/delete button). */
  function backspace() {
    if (hasError || overwriteOnNextDigit) return;
    display = display.length > 1 ? display.slice(0, -1) : "0";
  }

  /** Flips the sign of the current entry (+/-). */
  function toggleSign() {
    if (hasError || display === "0") return;
    display = display.startsWith("-") ? display.slice(1) : `-${display}`;
  }

  /** Converts the current entry to a percentage (divides by 100). */
  function percent() {
    if (hasError) return;
    display = String(parseFloat(display) / 100);
    overwriteOnNextDigit = true;
  }

  /**
   * Records the chosen operator. If an operator is already pending,
   * resolves it first (so "5 + 3 +" behaves like a running total,
   * the way physical calculators do).
   * @param {string} operator - "+", "-", "×", "÷"
   */
  function setOperator(operator) {
    if (hasError) return;

    if (pendingOperator && !overwriteOnNextDigit) {
      resolvePending();
    } else {
      storedValue = parseFloat(display);
    }

    pendingOperator = operator;
    overwriteOnNextDigit = true;
  }

  /** Resolves the pending operator against storedValue and the display. */
  function resolvePending() {
    try {
      const result = calculate(storedValue, pendingOperator, parseFloat(display));
      display = formatResult(result);
      storedValue = result;
    } catch (err) {
      display = "Error";
      hasError = true;
      storedValue = null;
      pendingOperator = null;
    }
  }

  /** Presses "=": resolves any pending operator and clears it. */
  function equals() {
    if (hasError || !pendingOperator) return;
    resolvePending();
    pendingOperator = null;
    overwriteOnNextDigit = true;
  }

  /** Formats a raw JS number for display (avoids float artifacts/overflow). */
  function formatResult(value) {
    if (!isFinite(value)) return "Error";
    // Round to avoid floating-point artifacts (e.g. 0.1 + 0.2 = 0.30000000000000004)
    const rounded = Math.round(value * 1e10) / 1e10;
    const asString = String(rounded);
    return asString.length > MAX_DISPLAY_DIGITS
      ? rounded.toExponential(4)
      : asString;
  }

  /** @returns {string} the current display value, ready to render */
  function getDisplay() {
    return display;
  }

  return {
    inputDigit,
    inputDecimal,
    backspace,
    toggleSign,
    percent,
    setOperator,
    equals,
    clear,
    getDisplay,
  };
}
