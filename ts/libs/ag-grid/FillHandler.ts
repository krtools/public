// fillHandle.ts
//
// Drop-in setFillValue for AG Grid's cellSelection.handle.setFillValue.
// Extends the default fill behavior to match Excel's auto-fill pattern
// recognition for days, months, text+number, and ISO date strings.
//
// Usage:
//   import { setFillValue } from './fillHandle';
//   gridOptions = { cellSelection: { handle: { mode: 'fill', setFillValue } } }

// Minimal subset of FillOperationParams that this function needs.
// If you have ag-grid-community installed you can replace this with:
//   import type { FillOperationParams } from 'ag-grid-community';
export interface FillParams {
  initialValues: unknown[];
  values: unknown[];        // initialValues + already-filled values so far
  currentIndex: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

const DAYS_SHORT   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Strict ISO date: exactly YYYY-MM-DD
const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

// Requires a non-digit prefix (at least one char) followed by digits.
// The alpha check in parseTextNum further restricts to prefixes with letters.
const TEXT_NUM_RE = /^(.*\D)(\d+)$/;

// ─── helpers ──────────────────────────────────────────────────────────────────

function isBackward(direction: string): boolean {
  return direction === 'up' || direction === 'left';
}

function indexInList(list: string[], val: unknown): number {
  const s = String(val).toLowerCase();
  return list.findIndex(item => item.toLowerCase() === s);
}

function allInList(list: string[], values: unknown[]): boolean {
  return values.every(v => indexInList(list, v) !== -1);
}

function detectCyclicStep(list: string[], initialValues: unknown[]): number {
  if (initialValues.length < 2) return 1;
  const i0 = indexInList(list, initialValues[0]);
  const i1 = indexInList(list, initialValues[1]);
  const diff = i1 - i0;
  return diff === 0 ? list.length : diff;
}

function cyclicFill(list: string[], initialValues: unknown[], values: unknown[], backward: boolean): string {
  const len  = list.length;
  let   step = detectCyclicStep(list, initialValues);
  if (backward) step = -step;
  const lastIdx = indexInList(list, values[values.length - 1]);
  return list[((lastIdx + step) % len + len) % len];
}

// ─── pattern matchers (return null = not applicable) ─────────────────────────

function fillDayOfWeek(initialValues: unknown[], values: unknown[], backward: boolean): string | null {
  if (allInList(DAYS_SHORT, initialValues)) {
    return cyclicFill(DAYS_SHORT, initialValues, values, backward);
  }
  if (allInList(DAYS_LONG, initialValues)) {
    return cyclicFill(DAYS_LONG, initialValues, values, backward);
  }
  return null;
}

function fillMonth(initialValues: unknown[], values: unknown[], backward: boolean): string | null {
  if (allInList(MONTHS_SHORT, initialValues)) {
    return cyclicFill(MONTHS_SHORT, initialValues, values, backward);
  }
  if (allInList(MONTHS_LONG, initialValues)) {
    return cyclicFill(MONTHS_LONG, initialValues, values, backward);
  }
  return null;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(isoA: string, isoB: string): number {
  const msA = new Date(`${isoA}T00:00:00Z`).getTime();
  const msB = new Date(`${isoB}T00:00:00Z`).getTime();
  return Math.round((msB - msA) / 86_400_000);
}

function fillISODate(initialValues: unknown[], values: unknown[], backward: boolean): string | null {
  if (!initialValues.every(v => ISO_DATE_RE.test(String(v)))) return null;

  let step = initialValues.length >= 2
    ? daysBetween(String(initialValues[0]), String(initialValues[1]))
    : 1;
  if (backward) step = -step;

  return addDays(String(values[values.length - 1]), step);
}

function parseTextNum(val: unknown): { prefix: string; num: number } | null {
  const s = String(val);
  // Must contain at least one letter — excludes "01/15/2025", "2025-01", plain numbers, etc.
  if (!/[a-zA-Z]/.test(s)) return null;
  const m = s.match(TEXT_NUM_RE);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

function fillTextNumber(initialValues: unknown[], values: unknown[], backward: boolean): string | null {
  const parsed = initialValues.map(parseTextNum);
  if (parsed.some(p => p === null)) return null;

  const prefix = parsed[0]!.prefix;
  if (!parsed.every(p => p!.prefix === prefix)) return null;

  let step = parsed.length >= 2 ? parsed[1]!.num - parsed[0]!.num : 1;
  if (backward) step = -step;

  const lastParsed = parseTextNum(values[values.length - 1]);
  if (!lastParsed || lastParsed.prefix !== prefix) return null;

  return `${prefix}${lastParsed.num + step}`;
}

// ─── public API ───────────────────────────────────────────────────────────────

export function setFillValue(params: FillParams): unknown {
  const { initialValues, values, direction } = params;

  if (!initialValues || initialValues.length === 0) return false;

  const backward = isBackward(direction);

  // ISO date is checked before text+number to prevent date strings like
  // "2025-01-15" from being treated as a text-prefix-number pattern.
  return (
    fillDayOfWeek(initialValues, values, backward) ??
    fillMonth(initialValues, values, backward) ??
    fillISODate(initialValues, values, backward) ??
    fillTextNumber(initialValues, values, backward) ??
    false
  );
}
