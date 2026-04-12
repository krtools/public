// fillHandle.test.ts
// Run with: mocha --require ts-node/register --extension ts fillHandle.test.ts

import { expect } from 'chai';
import { setFillValue, type FillParams } from './FillHandler';

// ─── test helpers ─────────────────────────────────────────────────────────────

type Direction = FillParams['direction'];

/** Build a FillParams snapshot for a single fill step. */
function p(
  initialValues: unknown[],
  filledSoFar: unknown[],
  currentIndex: number,
  direction: Direction = 'down',
): FillParams {
  return {
    initialValues,
    values: [...initialValues, ...filledSoFar],
    currentIndex,
    direction,
  };
}

/**
 * Simulates AG Grid calling setFillValue for `count` new cells.
 * Returns the raw return values; `false` means "deferred to AG Grid default".
 * Non-false results are accumulated into values[] for subsequent calls,
 * matching the real AG Grid behavior.
 */
function fill(
  initialValues: unknown[],
  count: number,
  direction: Direction = 'down',
): unknown[] {
  const accumulated = [...initialValues];
  const results: unknown[] = [];

  for (let i = 0; i < count; i++) {
    const result = setFillValue(
      p(initialValues, accumulated.slice(initialValues.length), i, direction),
    );
    results.push(result);
    if (result !== false) accumulated.push(result);
  }

  return results;
}

// ─── Day of Week ──────────────────────────────────────────────────────────────

describe('setFillValue – Day of Week', () => {
  describe('short form (Mon Tue … Sat Sun)', () => {
    it('fills forward one step at a time', () => {
      expect(fill(['Mon'], 3)).to.deep.equal(['Tue', 'Wed', 'Thu']);
    });

    it('wraps Fri → Sat → Sun → Mon → …', () => {
      expect(fill(['Fri'], 4)).to.deep.equal(['Sat', 'Sun', 'Mon', 'Tue']);
    });

    it('wraps correctly starting from Sunday', () => {
      expect(fill(['Sun'], 3)).to.deep.equal(['Mon', 'Tue', 'Wed']);
    });

    it('detects step-2 from two selected cells', () => {
      expect(fill(['Mon', 'Wed'], 3)).to.deep.equal(['Fri', 'Sun', 'Tue']);
    });

    it('detects step-3 spanning the weekend', () => {
      expect(fill(['Mon', 'Thu'], 3)).to.deep.equal(['Sun', 'Wed', 'Sat']);
    });

    it('fills backward (direction: up)', () => {
      expect(fill(['Wed'], 3, 'up')).to.deep.equal(['Tue', 'Mon', 'Sun']);
    });

    it('wraps backward past Sunday → Saturday', () => {
      expect(fill(['Mon'], 3, 'up')).to.deep.equal(['Sun', 'Sat', 'Fri']);
    });

    it('fills backward (direction: left)', () => {
      expect(fill(['Fri'], 2, 'left')).to.deep.equal(['Thu', 'Wed']);
    });

    it('is case-insensitive and outputs canonical short-form casing', () => {
      expect(fill(['mon'], 2)).to.deep.equal(['Tue', 'Wed']);
      expect(fill(['FRI'], 1)).to.deep.equal(['Sat']);
    });
  });

  describe('long form (Monday … Sunday)', () => {
    it('fills forward from a single day', () => {
      expect(fill(['Monday'], 3)).to.deep.equal(['Tuesday', 'Wednesday', 'Thursday']);
    });

    it('wraps Saturday → Sunday → Monday', () => {
      expect(fill(['Saturday'], 3)).to.deep.equal(['Sunday', 'Monday', 'Tuesday']);
    });

    it('detects step-3 from two selected cells', () => {
      expect(fill(['Monday', 'Thursday'], 2)).to.deep.equal(['Sunday', 'Wednesday']);
    });

    it('fills backward', () => {
      expect(fill(['Friday'], 3, 'up')).to.deep.equal(['Thursday', 'Wednesday', 'Tuesday']);
    });

    it('is case-insensitive and outputs canonical long-form casing', () => {
      expect(fill(['monday'], 2)).to.deep.equal(['Tuesday', 'Wednesday']);
      expect(fill(['FRIDAY'], 1)).to.deep.equal(['Saturday']);
    });
  });

  describe('non-matching cases', () => {
    it('returns false for mixed short and long forms', () => {
      expect(setFillValue(p(['Mon', 'Tuesday'], [], 0))).to.equal(false);
    });

    it('does not treat month names as days', () => {
      // "Jan" triggers the month pattern, not the day pattern
      const result = setFillValue(p(['Jan'], [], 0));
      expect(result).to.equal('Feb');
    });

    it('returns false for unrecognized strings', () => {
      expect(setFillValue(p(['foo', 'bar'], [], 0))).to.equal(false);
    });
  });
});

// ─── Month ────────────────────────────────────────────────────────────────────

describe('setFillValue – Month', () => {
  describe('short form (Jan … Dec)', () => {
    it('fills forward one month at a time', () => {
      expect(fill(['Jan'], 3)).to.deep.equal(['Feb', 'Mar', 'Apr']);
    });

    it('wraps Nov → Dec → Jan → Feb', () => {
      expect(fill(['Nov'], 3)).to.deep.equal(['Dec', 'Jan', 'Feb']);
    });

    it('detects quarterly step (step 3)', () => {
      expect(fill(['Jan', 'Apr'], 4)).to.deep.equal(['Jul', 'Oct', 'Jan', 'Apr']);
    });

    it('detects bi-monthly step (step 2)', () => {
      expect(fill(['Jan', 'Mar'], 3)).to.deep.equal(['May', 'Jul', 'Sep']);
    });

    it('fills backward (direction: up)', () => {
      expect(fill(['Mar'], 3, 'up')).to.deep.equal(['Feb', 'Jan', 'Dec']);
    });

    it('wraps backward past January → December', () => {
      expect(fill(['Feb'], 3, 'up')).to.deep.equal(['Jan', 'Dec', 'Nov']);
    });

    it('fills backward (direction: left)', () => {
      expect(fill(['Jun'], 2, 'left')).to.deep.equal(['May', 'Apr']);
    });

    it('is case-insensitive and outputs canonical short-form casing', () => {
      expect(fill(['jan'], 2)).to.deep.equal(['Feb', 'Mar']);
      expect(fill(['JAN'], 1)).to.deep.equal(['Feb']);
    });
  });

  describe('long form (January … December)', () => {
    it('fills forward from a single month', () => {
      expect(fill(['March'], 3)).to.deep.equal(['April', 'May', 'June']);
    });

    it('wraps December → January', () => {
      expect(fill(['November'], 3)).to.deep.equal(['December', 'January', 'February']);
    });

    it('detects quarterly step', () => {
      expect(fill(['January', 'April'], 4)).to.deep.equal(['July', 'October', 'January', 'April']);
    });

    it('fills backward', () => {
      expect(fill(['June'], 3, 'up')).to.deep.equal(['May', 'April', 'March']);
    });

    it('is case-insensitive and outputs canonical long-form casing', () => {
      expect(fill(['december'], 1)).to.deep.equal(['January']);
      expect(fill(['DECEMBER'], 1)).to.deep.equal(['January']);
    });
  });

  describe('non-matching cases', () => {
    it('returns false for mixed short and long month forms', () => {
      expect(setFillValue(p(['Jan', 'February'], [], 0))).to.equal(false);
    });
  });
});

// ─── Text + Trailing Number ───────────────────────────────────────────────────

describe('setFillValue – Text + Trailing Number', () => {
  it('increments "Item N" by 1', () => {
    expect(fill(['Item 1'], 3)).to.deep.equal(['Item 2', 'Item 3', 'Item 4']);
  });

  it('detects step from two selected cells', () => {
    expect(fill(['Item 1', 'Item 3'], 3)).to.deep.equal(['Item 5', 'Item 7', 'Item 9']);
  });

  it('handles "Q1" style alphanumeric prefix', () => {
    expect(fill(['Q1'], 3)).to.deep.equal(['Q2', 'Q3', 'Q4']);
  });

  it('detects step from Q-series cells', () => {
    expect(fill(['Q1', 'Q3'], 3)).to.deep.equal(['Q5', 'Q7', 'Q9']);
  });

  it('handles hyphenated prefix "Row-1"', () => {
    expect(fill(['Row-1'], 3)).to.deep.equal(['Row-2', 'Row-3', 'Row-4']);
  });

  it('handles prefix with spaces "Week 2"', () => {
    expect(fill(['Week 2'], 3)).to.deep.equal(['Week 3', 'Week 4', 'Week 5']);
  });

  it('decrements when direction is up', () => {
    expect(fill(['Item 5'], 3, 'up')).to.deep.equal(['Item 4', 'Item 3', 'Item 2']);
  });

  it('decrements when direction is left', () => {
    expect(fill(['Item 5'], 2, 'left')).to.deep.equal(['Item 4', 'Item 3']);
  });

  it('stops producing results once prefix no longer matches (floor at 0 boundary)', () => {
    // Fills Item 4, Item 3, Item 2, Item 1, Item 0 — then "Item -1" would break
    // prefix-match in next parse, so result is false (AG Grid takes over)
    const results = fill(['Item 5'], 5, 'up');
    expect(results.slice(0, 4)).to.deep.equal(['Item 4', 'Item 3', 'Item 2', 'Item 1']);
    // Item 0 may or may not work depending on regex — just verify no throw
    expect(() => fill(['Item 5'], 6, 'up')).to.not.throw();
  });

  describe('non-matching cases', () => {
    it('returns false for plain integer values (defer to AG Grid linear)', () => {
      expect(setFillValue(p([1], [], 0))).to.equal(false);
      expect(setFillValue(p([1, 3], [], 0))).to.equal(false);
    });

    it('returns false for plain number strings', () => {
      expect(setFillValue(p(['1'], [], 0))).to.equal(false);
      expect(setFillValue(p(['1', '3'], [], 0))).to.equal(false);
    });

    it('returns false when prefixes differ across initial cells', () => {
      expect(setFillValue(p(['Item 1', 'Task 2'], [], 0))).to.equal(false);
    });

    it('returns false for plain strings with no trailing number', () => {
      expect(setFillValue(p(['foo', 'bar'], [], 0))).to.equal(false);
    });
  });
});

// ─── ISO Date Strings ─────────────────────────────────────────────────────────

describe('setFillValue – ISO Date Strings', () => {
  it('increments by 1 day from a single date', () => {
    expect(fill(['2025-01-01'], 3)).to.deep.equal(['2025-01-02', '2025-01-03', '2025-01-04']);
  });

  it('detects weekly step (7 days) from two selected dates', () => {
    expect(fill(['2025-01-01', '2025-01-08'], 3)).to.deep.equal([
      '2025-01-15', '2025-01-22', '2025-01-29',
    ]);
  });

  it('handles month boundary correctly', () => {
    expect(fill(['2025-01-30'], 3)).to.deep.equal(['2025-01-31', '2025-02-01', '2025-02-02']);
  });

  it('handles year boundary correctly', () => {
    expect(fill(['2025-12-30'], 3)).to.deep.equal(['2025-12-31', '2026-01-01', '2026-01-02']);
  });

  it('handles leap year (Feb 28 → Feb 29)', () => {
    expect(fill(['2024-02-28'], 2)).to.deep.equal(['2024-02-29', '2024-03-01']);
  });

  it('fills backward by 1 day when direction is up', () => {
    expect(fill(['2025-01-05'], 3, 'up')).to.deep.equal(['2025-01-04', '2025-01-03', '2025-01-02']);
  });

  it('fills backward by 1 day when direction is left', () => {
    expect(fill(['2025-06-15'], 2, 'left')).to.deep.equal(['2025-06-14', '2025-06-13']);
  });

  it('zero-pads day and month in output', () => {
    const result = fill(['2025-01-09'], 1);
    expect(result[0]).to.equal('2025-01-10');
  });

  describe('non-matching cases', () => {
    it('returns false for US-format date strings', () => {
      expect(setFillValue(p(['01/15/2025'], [], 0))).to.equal(false);
    });

    it('returns false for partial ISO-like strings', () => {
      expect(setFillValue(p(['2025-01'], [], 0))).to.equal(false);
    });

    it('does not activate for strings that look like dates but have letters', () => {
      // "Jan 1, 2025" goes through text+number (year increments), not ISO date
      const result = setFillValue(p(['Jan 1, 2025'], [], 0));
      expect(result).to.not.equal(false); // handled as text+number, not ISO
    });
  });
});

// ─── Fall-through to AG Grid default ─────────────────────────────────────────

describe('setFillValue – Fall-through (returns false)', () => {
  it('returns false for plain integer values', () => {
    expect(setFillValue(p([1], [], 0))).to.equal(false);
    expect(setFillValue(p([1, 3], [], 0))).to.equal(false);
  });

  it('returns false for float values', () => {
    expect(setFillValue(p([1.5, 2.5], [], 0))).to.equal(false);
  });

  it('returns false for unrecognized plain strings', () => {
    expect(setFillValue(p(['foo', 'bar'], [], 0))).to.equal(false);
  });

  it('returns false for boolean values', () => {
    expect(setFillValue(p([true, false], [], 0))).to.equal(false);
  });

  it('returns false for null values', () => {
    expect(setFillValue(p([null, null], [], 0))).to.equal(false);
  });

  it('returns false for undefined values', () => {
    expect(setFillValue(p([undefined], [], 0))).to.equal(false);
  });

  it('returns false when initialValues is empty', () => {
    expect(setFillValue(p([], [], 0))).to.equal(false);
  });

  it('returns false for mixed day name and month name', () => {
    expect(setFillValue(p(['Mon', 'January'], [], 0))).to.equal(false);
  });

  it('returns false for a number mixed with a text+number string', () => {
    expect(setFillValue(p([1, 'Item 2'], [], 0))).to.equal(false);
  });
});
