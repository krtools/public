export interface RangeEntry<T> {
  start: number; // inclusive lower bound
  end: number;   // inclusive upper bound
  value: T;
}

export class RangeLookup<T> {
  // entries kept sorted by `start`; ranges may have gaps between them
  private entries: RangeEntry<T>[];

  constructor(entries: RangeEntry<T>[]) {
    this.entries = [...entries].sort((a, b) => a.start - b.start);
  }

  lookup(key: number): T | undefined {
    let lo = 0;
    let hi = this.entries.length - 1;
    let candidate = -1;

    // find the rightmost entry whose start <= key
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (this.entries[mid].start <= key) {
        candidate = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // candidate is the only range that could contain key; verify the upper bound
    if (candidate === -1) return undefined;
    const entry = this.entries[candidate];
    return key <= entry.end ? entry.value : undefined;
  }
}
