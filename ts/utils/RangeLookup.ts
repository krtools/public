export interface RangeEntry<T> {
  start: number; // inclusive lower bound of the range
  value: T;
}

export class RangeLookup<T> {
  // entries kept sorted by `start`; each range runs until the next entry's start
  private entries: RangeEntry<T>[];

  constructor(entries: RangeEntry<T>[]) {
    this.entries = [...entries].sort((a, b) => a.start - b.start);
  }

  lookup(key: number): T | undefined {
    let lo = 0;
    let hi = this.entries.length - 1;
    let result: T | undefined;

    // find the rightmost entry whose start <= key
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (this.entries[mid].start <= key) {
        result = this.entries[mid].value;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return result;
  }
}
