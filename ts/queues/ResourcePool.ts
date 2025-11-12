export interface ResourcePoolOptions<T> {
  limit: number;
  create: () => T | Promise<T>;
  dispose?: (item: T) => unknown;
}

export interface ResourceItem<T> {
  value: T;
  release: () => void;
  [Symbol.dispose]: () => void;
}

export class ResourcePool<T> {
  private options: ResourcePoolOptions<T>;

  private closed = false;
  private pool: T[] = [];
  private total = 0;
  private inUse = new Set<T>();

  private queue: PromiseWithResolvers<T>[] = [];

  constructor(opts: ResourcePoolOptions<T>) {
    this.options = opts;
  }

  public get size() {
    return this.pool.length;
  }

  public get running() {
    return this.inUse.size;
  }

  private async _take() {
    if (this.pool.length) {
      const r = this.pool.pop()!;
      this.inUse.add(r);
      return r;
    }

    if (this.total < this.options.limit) {
      this.total++;
      try {
        const r = await this.options.create();
        this.inUse.add(r);
        return r;
      } catch (e) {
        this.total--;
        throw e;
      }
    }

    const pw = Promise.withResolvers<T>();
    this.queue.push(pw);
    return pw.promise;
  }

  async _release(value: T) {
    if (!this.inUse.has(value)) return;
    this.inUse.delete(value);

    if (this.closed) {
      await this.options.dispose?.(value);
      this.total--;
    } else if (this.queue.length) {
      const next = this.queue.shift()!;
      this.inUse.add(value);
      next.resolve(value);
    } else {
      this.pool.push(value);
    }
  }

  async acquire(): Promise<ResourceItem<T>> {
    if (this.closed) throw new Error('ResourcePool is closed');

    const value = await this._take();
    const release = () => void this._release(value);

    return {value, release, [Symbol.dispose]: release};
  }

  async close() {
    if (this.closed) return;
    this.closed = true;

    // reject queued acquisitions
    this.queue.forEach((pw) => pw.reject(new Error('ResourcePool closed')));

    this.queue = [];
    if (this.options.dispose) {
      await Promise.all([...this.pool, ...this.inUse].map((r) => this.options.dispose!(r)));
    }
    this.total = 0;
    this.pool = [];
    this.inUse.clear();
  }

  [Symbol.asyncDispose]() {
    return this.close();
  }
}
