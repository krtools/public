export class WeakMapWithSupplier<K extends object, V> extends WeakMap<K, V> {
  private readonly _supplier: Mapper<K, V>;

  constructor(supplier: Mapper<K, V>) {
    super();
    this._supplier = supplier;
  }

  public get(key: K): V {
    if (!this.has(key)) {
      const value = this._supplier(key);
      this.set(key, value);
      return value;
    }
    return super.get(key)!;
  }
}

export class MapWithSupplier<K, V> extends Map<K, V> {
  readonly #supplier: Mapper<K, V>;

  constructor(supplier: Mapper<K, V>, entries: ReadonlyArray<[K, V]> | null | undefined = null) {
    super(entries);
    this.#supplier = supplier;
  }

  public nativeGet(key: K): V | undefined {
    return super.get(key);
  }

  public get(key: K): V {
    let value = super.get(key);
    if (value === undefined) {
      value = this.#supplier(key);
      this.set(key, value);
    }
    return value;
  }
}

export abstract class BaseMap<K, V, I extends Iterable<V>> extends MapWithSupplier<K, I> {
  public abstract add(k: K, v: V): this;

  public abstract hasValue(k: K, v: V): boolean;

  protected constructor(supplier: Mapper<K, I>, entries: Iterable<[K, Iterable<V>]>) {
    super(supplier);
    if (entries) this.fill(entries);
  }

  public toJSON(): Record<keyof any, V[]> {
    const o: Record<keyof any, V[]> = {};
    for (const [k, v] of this.entries()) o[typeof k === 'symbol' ? k : String(k)] = [...v];
    return o;
  }

  public addAll(key: K, values: Iterable<V>): this {
    for (const v of values) this.add(key, v);
    return this;
  }

  public addEach(keys: Iterable<K>, value: V): this {
    for (const key of keys) this.add(key, value);
    return this;
  }

  public addEntries(entries: Iterable<[K, V]>): this {
    for (const [k, v] of entries) this.add(k, v);
    return this;
  }

  public addEntriesInverted(entries: Iterable<[V, K]>): this {
    for (const [v, k] of entries) this.add(k, v);
    return this;
  }

  public fillInverted(entries: Iterable<[V, Iterable<K>]>): this {
    for (const [v, k] of entries) this.addEach(k, v);
    return this;
  }

  public fill(entries: Iterable<[K, Iterable<V>]>): this {
    for (const [k, v] of entries) this.addAll(k, v);
    return this;
  }

  public indexAs<T>(values: Iterable<T>, getEntry: (val: T) => [K, V]) {
    for (const val of values) this.add(...getEntry(val));
    return this;
  }

  public index(values: Iterable<V>, getKey: (val: V) => K) {
    for (const t of values) this.add(getKey(t), t);
    return this;
  }

  public multiIndex(values: Iterable<V>, getKeys: (val: V) => Iterable<K>) {
    for (const v of values) for (const key of getKeys(v)) this.add(key, v);
    return this;
  }

  public firstNonEmpty(...key: K[]): I | undefined {
    for (const k of key) {
      const v = this.has(k) ? this.nativeGet(k) : undefined;
      if (v) return v;
    }
  }
}

export class Multimap<K, V> extends BaseMap<K, V, V[]> {
  static index = <K, V>(values: Iterable<V>, getKey: (val: V) => K) => new this<K, V>().index(values, getKey);
  static multiIndex = <K, V>(values: Iterable<V>, getKeys: (val: V) => Iterable<K>) => new this<K, V>().multiIndex(values, getKeys);

  public constructor(entries?: Iterable<Tuple<K, Iterable<V>>>) {
    super(() => [], []);
    for (const [k, v] of entries ?? []) this.addAll(k, v);
  }

  public invert(): Multimap<V, K> {
    return new Multimap<V, K>().fillInverted(this.entries());
  }

  public sortedHighestCount(): Multimap<K, V> {
    const entries = [...this.entries()].sort((a, b) => natural(b[1].length, a[1].length)) as any;
    return new Multimap<K, V>(entries);
  }

  public add(k: K, v: V): this {
    this.get(k).push(v);
    return this;
  }

  public hasValue(k: K, v: V): boolean {
    return this.has(k) && this.get(k).includes(v);
  }
}

export class SetMultimap<K, V> extends BaseMap<K, V, Set<V>> {
  static index = <K, V>(values: Iterable<V>, getKey: (val: V) => K) => new this<K, V>().index(values, getKey);
  static multiIndex = <K, V>(values: Iterable<V>, getKeys: (val: V) => Iterable<K>) => new this<K, V>().multiIndex(values, getKeys);

  public static build<K, V>(): SetMultimap<K, V> {
    return new SetMultimap<K, V>();
  }

  public constructor(entries?: Iterable<[K, Set<V>]>) {
    super(() => new Set<V>(), entries ?? []);
  }

  public toMultimap(): Multimap<K, V> {
    return new Multimap<K, V>(this);
  }

  public invert(): SetMultimap<V, K> {
    return new SetMultimap<V, K>().fillInverted(this.entries());
  }

  public sortedHighestCount(): SetMultimap<K, V> {
    const entries = [...this.entries()].sort((a, b) => natural(b[1].size, a[1].size)) as any;
    return new SetMultimap(entries);
  }

  public add(k: K, v: V): this {
    this.get(k).add(v);
    return this;
  }

  public getAsArray(k: K): V[] {
    return this.has(k) ? [...this.get(k)] : [];
  }

  public hasValue(k: K, v: V): boolean {
    return this.has(k) && this.get(k).has(v);
  }
}

export class Multiset<V> implements Iterable<[V, number]> {
  private readonly m = new Map<V, number>();

  constructor(values?: Iterable<V>) {
    if (values) for (const entry of values) this.add(entry);
  }

  public static of<T>(entries: Array<[T, number]>) {
    const mset = new Multiset();
    for (const [t, n] of entries) mset.add(t, n);
    return mset;
  }

  public add(value: V, amount = 1): this {
    this.m.set(value, this.count(value) + amount);
    return this;
  }

  public count(value: V): number {
    return this.m.has(value) ? this.m.get(value)! : 0;
  }

  public values(): IterableIterator<V> {
    return this.m.keys();
  }

  public asMap(): Map<V, number> {
    return new Map(this.m.entries());
  }

  /** Number of keys (buckets) */
  public get size() {
    return this.m.size;
  }

  public sortedHighestCount(): Map<V, number> {
    return new Map([...this.m.entries()].sort((a, b) => natural(b[1], a[1])));
  }

  public entries() {
    return this[Symbol.iterator];
  }

  public *[Symbol.iterator](): Iterator<[V, number]> {
    yield* this.m.entries();
  }
}

export function toJSON(map: Map<string, any>) {
  const obj: any = {};
  for (const key of map.keys()) {
    obj[key] = map.get(key);
  }
  return obj;
}

export function setKey<K>(map: Map<K, unknown>, key: K, newKey: K): void {
  if (map.has(key)) {
    if (map.has(newKey)) {
      throw new Error(`key already exists! ${newKey}`);
    }
    map.set(newKey, map.get(key));
    map.delete(key);
  }
}

export function deleteWhere<K, V>(map: Map<K, V>, param2: (v: V, k: K) => unknown) {
  for (const [k, v] of map.entries()) {
    if (param2(v, k)) {
      map.delete(k);
    }
  }
}

export function mapBy<V, K>(items: V[], fn: (v: V) => K): Map<K, V> {
  const map = new Map<K, V>();
  for (const item of items) map.set(fn(item), item);
  return map;
}

export function mapTo<V, K>(items: K[], fn: (v: K) => V): Map<K, V> {
  const map = new Map<K, V>();
  for (const item of items) map.set(item, fn(item));
  return map;
}

/** A basic 2-dimensional map (roughly matching the guava equivalent) */
export class Table<R = any, C = any, V = any> {
  private _rows = new MapWithSupplier<R, Map<C, V>>(() => new Map());

  public *[Symbol.iterator](): IterableIterator<[R, Map<C, V>]> {
    for (const rowKey of this.rowKeys()) {
      yield [rowKey, this.row(rowKey)];
    }
  }

  /** Iterate through all the Row/Col/Col Combinations */
  public *cells(): IterableIterator<[R, C, V]> {
    for (const [row, cols] of this) {
      for (const [col, value] of cols) {
        yield [row, col, value];
      }
    }
  }

  /** get a live-editable row, or create it if it doesn't exist */
  public row(id: R): Map<C, V> {
    return this._rows.get(id)!;
  }

  public rowKeys(): IterableIterator<R> {
    return this._rows.keys();
  }

  /** Clears out the entire table */
  public clear() {
    this._rows.clear();
  }

  /** delete a row, returns true if there was something to delete */
  public delete(row: R): boolean {
    return this._rows.delete(row);
  }

  /** Deletes a specific column (runs in O(n) time) */
  public deleteCol(col: C): boolean {
    let deleted = false;
    for (const row of this._rows.values()) {
      deleted = deleted || row.delete(col);
    }
    return deleted;
  }

  /** Delete a row/col combination from the table */
  public deleteValue(row: R, col: C): boolean {
    return this._rows.has(row) ? this.row(row).delete(col) : false;
  }

  /** Returns the value at the specified row/col "coordinates" */
  public get(row: R, col: C): V | undefined {
    return this._rows.has(row) ? this._rows.get(row).get(col) : undefined;
  }

  /** Set a specific value at a specific row and column  */
  public set(row: R, col: C, value: V): this {
    this.row(row).set(col, value);
    return this;
  }

  /** Returns true if the row exists */
  public hasRow(row: R): boolean {
    return this._rows.has(row);
  }

  public get size() {
    return this._rows.size;
  }

  /** Returns a (new) map of row-to-values for a given column id */
  public column(col: C): Map<R, V> {
    const map = new Map<R, V>();
    for (const row of this._rows.keys()) {
      const m = this._rows.get(row)!;
      if (m.has(col)) map.set(row, m.get(col)!);
    }
    return map;
  }
}

export class TableWithSupplier<R, C, V> extends Table<R, C, V> {
  private readonly _supplier: () => V;

  /**
   * @param supplier an optional supplier to create a the value when queried
   */
  constructor(supplier: () => V) {
    super();
    this._supplier = supplier;
  }

  public get(row: R, col: C): V {
    const r = this.row(row);
    if (!r.has(col)) {
      const value = this._supplier();
      r.set(col, value);
      return value;
    }
    return r.get(col)!;
  }
}
