# Excel-like Fill Handle Spec for AG Grid

## Overview

`setFillValue` plugs into `cellSelection.handle.setFillValue`. Return a value to
override AG Grid's default fill; return `false` to defer to it.

AG Grid's built-in behavior already handles:
- Copying a single cell value
- Linear number progression (1, 3 → 5, 7, …)
- Cycling through a selected range of mixed/string values
- Incrementing a single number by 1 when Alt is held

This function extends that with Excel-style pattern recognition for the cases
below.

---

## Behaviors

### 1. Day of Week — Short and Long Form

**Trigger** — every value in `initialValues` is a recognized day name
(case-insensitive). Short form: `Sun Mon Tue Wed Thu Fri Sat`. Long form:
`Sunday Monday … Saturday`. Mixed short/long does **not** trigger.

**Step detection** — if `initialValues.length >= 2`, step = dayIndex(cell[1]) −
dayIndex(cell[0]). Defaults to 1 for a single cell.

**Wrap-around** — after Saturday → Sunday, before Sunday → Saturday (modulo 7).

**Direction** — `up` or `left` negates the detected step (fills backward through
the week).

**Output format** — canonical casing of the detected list (e.g. input `"mon"` →
output `"Tue"`).

---

### 2. Month — Short and Long Form

**Trigger** — every value in `initialValues` is a recognized month name
(case-insensitive). Short: `Jan Feb … Dec`. Long: `January February … December`.
Mixed short/long does **not** trigger.

**Step detection** — same approach as days; default step = 1.

**Wrap-around** — after December → January, before January → December (modulo 12).

**Direction** — `up` or `left` negates the step.

**Output format** — canonical casing of the detected list.

---

### 3. Text + Trailing Number

**Trigger** — every value in `initialValues` matches the pattern
`<non-numeric prefix><integer>` (regex: `/^(.*\D)(\d+)$/`). Plain integers like
`"1"` or `42` do **not** match (no non-digit prefix). Every cell must share the
same prefix exactly.

Examples: `"Item 1"`, `"Q3"`, `"Row-4"`, `"Week 12"`.

**Step detection** — `initialValues[1].num − initialValues[0].num` if two or more
cells are selected; default step = 1.

**Direction** — `up` or `left` negates the step. Negative results are allowed (no
clamping).

**Output format** — `prefix + (lastNumber + step)`.

---

### 4. ISO Date Strings

**Trigger** — every value in `initialValues` matches `YYYY-MM-DD` exactly.

**Step detection** — difference in whole days between `initialValues[0]` and
`initialValues[1]` if available; default step = +1 day.

**Direction** — `up` or `left` negates the step.

**Output format** — `YYYY-MM-DD`.

Note: non-ISO formats (`01/15/2025`, `"Jan 15"`) do **not** trigger; they fall
through to AG Grid's default.

---

## Priority Order

When multiple patterns could match, the function checks in this order:

1. Day of week
2. Month
3. Text + trailing number
4. ISO date string
5. `false` (AG Grid default)

---

## Fall-through Cases (return `false`)

The function returns `false` and defers to AG Grid for:

- Plain numbers (integers, floats) — AG Grid linear progression is correct
- Plain number strings (`"1"`, `"2.5"`) — same
- Unrecognized strings with no trailing number
- Boolean values
- `null` / `undefined`
- Mixed types (day + month, number + string, etc.)
- Empty `initialValues`

---

## Out of Scope

- Geometric / growth series (Excel requires the explicit Series… dialog)
- Custom user-defined lists
- Date objects (only ISO strings are handled; add a pre-pass `valueFormatter` if
  your column stores `Date` objects)
- Trend/linear-regression fill
- Right-click-drag "Flash Fill" style inference
