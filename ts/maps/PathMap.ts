type Node<K, V> = {
  children: Map<K, Node<K, V>>;
  value?: V;
};

export class PathMap<K, V> implements Iterable<[K[], V]> {
  private root: Node<K, V> = {children: new Map()};
  private _size = 0;

  get size(): number {
    return this._size;
  }

  set(path: readonly K[], value: V): V {
    let node = this.root;
    for (const key of path) {
      let next = node.children.get(key);
      if (!next) node.children.set(key, (next = {children: new Map()}));
      node = next;
    }
    if (node.value === undefined) this._size++;
    node.value = value;
    return value;
  }

  get(path: readonly K[]): V | undefined {
    let node: Node<K, V> | undefined = this.root;
    for (const key of path) {
      node = node.children.get(key);
      if (!node) return;
    }
    return node.value;
  }

  getOrCreate(path: readonly K[], supplier: () => V): V {
    let node = this.root;
    for (const key of path) {
      let next = node.children.get(key);
      if (!next) node.children.set(key, (next = {children: new Map()}));
      node = next;
    }
    if (node.value === undefined) {
      node.value = supplier();
      this._size++;
    }
    return node.value;
  }

  has(path: readonly K[]): boolean {
    return this.get(path) !== undefined;
  }

  delete(path: readonly K[]): boolean {
    const stack: [Node<K, V>, K][] = [];
    let node: Node<K, V> | undefined = this.root;

    for (const key of path) {
      if (!node) return false;
      stack.push([node, key]);
      node = node.children.get(key);
    }

    if (!node || node.value === undefined) return false;

    delete node.value;
    this._size--;

    // prune empty nodes bottom-up
    for (let i = stack.length - 1; i >= 0; i--) {
      const [parent, key] = stack[i];
      const child = parent.children.get(key)!;
      if (child.value === undefined && child.children.size === 0) {
        parent.children.delete(key);
      } else break;
    }

    return true;
  }

  *entries(node = this.root, path: K[] = []): IterableIterator<[K[], V]> {
    if (node.value !== undefined) yield [path, node.value];
    for (const [k, child] of node.children) {
      yield* this.entries(child, [...path, k]);
    }
  }

  *keys(): IterableIterator<K[]> {
    for (const [path] of this.entries()) yield path;
  }

  *values(): IterableIterator<V> {
    for (const [, value] of this.entries()) yield value;
  }

  [Symbol.iterator](): IterableIterator<[K[], V]> {
    return this.entries();
  }
}
