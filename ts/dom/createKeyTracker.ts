/**
 * Tracks whether a key is currently held down based on a predicate.
 * Resets on window blur or tab hide.
 *
 * @example
 * const ctrl = createKeyTracker(e => e.key === "Control");
 * ctrl.isPressed;
 */
export function createKeyTracker(predicate: (e: KeyboardEvent) => boolean) {
  const ac = new AbortController();
  const opts = { signal: ac.signal };
 
  let pressed = false;
 
  window.addEventListener("keydown", (e) => { if (predicate(e)) pressed = true; }, opts);
  window.addEventListener("keyup", (e) => { if (predicate(e)) pressed = false; }, opts);
  window.addEventListener("blur", () => { pressed = false; }, opts);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pressed = false; }, opts);
 
  return {
    get isPressed() { return pressed; },
    destroy() { ac.abort(); },
  };
}
