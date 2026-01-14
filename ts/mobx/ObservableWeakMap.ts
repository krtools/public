import {createAtom, IAtom} from 'mobx';

/** A weak map that allows you to observably attach arbitrary values to objects */
export class ObservableWeakMap<K extends object, V> {
  private map = new WeakMap<K, {atom: IAtom; value?: V}>();

  private entry(key: K) {
    let e = this.map.get(key);
    if (!e) {
      e = {atom: createAtom('WeakObservableMap')};
      this.map.set(key, e);
    }
    return e;
  }

  get(key: K): V | undefined {
    const e = this.entry(key);
    e.atom.reportObserved();
    return e.value;
  }

  set(key: K, value: V) {
    const e = this.entry(key);
    e.value = value;
    e.atom.reportChanged();
  }

  has(key: K) {
    const e = this.entry(key);
    e.atom.reportObserved();
    return 'value' in e;
  }

  delete(key: K) {
    const e = this.map.get(key);
    if (!e) return false;
    this.map.delete(key);
    e.atom.reportChanged();
    return true;
  }
}
