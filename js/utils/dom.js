/* =========================================================
   dom.js
   Small, framework-free DOM helpers.

   Why: app.js previously called `document.getElementById` /
   `document.querySelectorAll` directly everywhere, with no
   guard against a missing element. In a small app that's
   forgivable, but it's a common source of silent bugs — e.g.
   a typo'd id makes a feature quietly stop working with no
   error anywhere. These helpers centralize lookups and warn
   loudly (in dev tools) if something expected isn't found,
   which makes future refactors much safer.
========================================================= */

/**
 * Shorthand for querySelector, with an optional console warning
 * if the element isn't found (helps catch typos/markup drift early).
 * @param {string} selector
 * @param {ParentNode} [scope=document]
 * @returns {Element | null}
 */
export function $(selector, scope = document) {
  const el = scope.querySelector(selector);
  if (!el) {
    console.warn(`[UnitKit] Element not found for selector: "${selector}"`);
  }
  return el;
}

/**
 * Shorthand for querySelectorAll that returns a real Array
 * (so .map/.filter/.forEach all work without extra conversion).
 * @param {string} selector
 * @param {ParentNode} [scope=document]
 * @returns {Element[]}
 */
export function $$(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/**
 * Debounces a function: delays calling it until `delay` ms have
 * passed since the last time it was invoked. Used to avoid
 * recalculating currency conversion on every single keystroke.
 * @param {Function} fn
 * @param {number} delay - milliseconds
 * @returns {Function} debounced version of fn
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}
