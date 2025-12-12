import {computed, observable, action, autorun} from 'mobx';
import {natural, asArray} from '@todo';
import {addAll, setsEqual} from '@todo';
import {CompareFunction} from '@todo';
import {ObservableBoolean, ObservableRef} from '@todo';

export interface ObservableAggOptions<T> {
  /** The name of the aggregation (for UI) */
  name: string;
  /** Whether to start out as active */
  defaultActive?: boolean;
  /** Set up the autorun for the items to auto-compute (when active) */
  auto?: boolean;
  /** the (presumed) observable array of items to aggregate */
  getItems: () => T[];
  /** Generate aggregation keys for the values */
  getKeys: (item: T) => string | string[];
  /** Fires when exclusions are added */
  onAddExcludes?: (excludes: T[]) => void;
}

export class ObservableAgg<T> {
  @observable.ref
  public literal?: T[] = undefined;

  public readonly active = new ObservableBoolean(false);
  public readonly sortBy = new ObservableRef<'name' | 'count'>('count');

  public readonly selectedKeys = observable.set<string>([], {deep: false});

  public dispose?: () => void;

  @observable
  public excludes = observable.set<T>([], {deep: false});

  @action
  public addExcludes(values: Iterable<T>) {
    addAll(this.excludes, values);
    this.selectedKeys.clear();
    this.compute();
  }

  @action
  public addExcludesByKey(keys: Iterable<string> | string) {
    const arr = typeof keys === 'string' ? [keys] : [...keys];
    this.addExcludes(arr.flatMap((k) => this.map.get(k) ?? []));
    arr.forEach((e) => this.selectedKeys.delete(e));
  }

  @action
  public shiftAggSelectionDown(key: string) {
    const keys = [...this.sorted.map((e) => e[0])];
    const index = keys.indexOf(key);
    if (index === -1 || index > keys.length - 1) return;
    const nextKey = keys[index + 1];
    this.addExcludesByKey(key);
    this.selectedKeys.add(nextKey);
  }

  @action
  public excludeAllSelected() {
    this.addExcludesByKey(this.selectedKeys);
  }

  @computed({equals: setsEqual})
  public get selectedValues() {
    const set = new Set<T>();
    const map = this.map;

    for (const key of this.selectedKeys) {
      const values = map.get(key);
      if (values) addAll(set, values);
    }
    return set;
  }

  @computed
  public get filterFn() {
    const incl = this.selectedValues;
    const excl = this.excludes;

    if (!incl?.size && !excl?.size) return () => true;
    return (item: T) => {
      if (incl?.size && !incl.has(item)) return false;
      if (excl?.size && excl.has(item)) return false;
      return true;
    };
  }

  public skipNextCompute = false;

  @observable.ref
  public map?: Map<string, T[]>;

  @computed
  public get sorted() {
    return [...this.map].toSorted(this.sorter());
  }

  public sorter = (): CompareFunction<[string, T[]]> => {
    const type = this.sortBy.value;

    if (type === 'count') return (a, b) => -natural(a[1].length, b[1].length);
    else return (a, b) => natural(a[0], b[0]);
  };

  @action
  public computeActivate() {
    this.compute();
    this.active.set(true);
  }

  @action
  public compute() {
    if (this.skipNextCompute && this.map) {
      this.skipNextCompute = false;
      return this.map;
    }

    const mm = new Map<string, T[]>();
    for (const item of this.opts.getItems()) {
      for (const key of asArray(this.opts.getKeys(item))) {
        let arr = mm.get(key);
        if (!arr) mm.set(key, (arr = []));
        arr.push(item);
      }
    }
    return (this.map = mm);
  }

  public constructor(public opts: ObservableAggOptions<T>) {
    this.active.setInternalIfDefined(opts.defaultActive);
    if (opts.auto) this.dispose = autorun(() => this.active.value && this.compute());
  }
}
