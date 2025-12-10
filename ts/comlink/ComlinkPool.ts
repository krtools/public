import {Remote} from 'comlink';
import PQueue from 'p-queue';

export interface ComlinkAdapter<T, W> {
  /** Create a new endpoint object for `wrap`, typically a node Worker or MessagePort */
  createEndpoint: () => W;
  /** Wrap the created endpoint to create a remote comlink proxy */
  wrap: (endpoint: W) => Remote<T>;
  /** How to terminate the endpoint. usually `close()` or `terminate()` */
  terminate: (endpoint: W) => unknown;
}

export interface ComlinkPoolOptions<T, W> {
  /** Max allowed pool size. defaults to 1 */
  concurrency?: number;
  /** tells us how to start, stop, and wrap the workers */
  adapter: ComlinkAdapter<T, W>;
  /** defaults to true, if false, immediately starts up workers */
  lazy?: boolean;
  /** Clean up resources on the remote end before termination, if applicable (awaits result) */
  onBeforeDispose?: (r: Remote<T>, w: W) => unknown | Promise<unknown>;
}

/** Options without the adapter (for subclasses) */
export type BaseComlinkPoolOptions<T, W> = Omit<ComlinkPoolOptions<T, W>, 'adapter'>;

type Slot<T, W> = {endpoint: W; remote: Remote<T>};

export type PoolTask<T, V> = (remote: Remote<T>) => V | Promise<V>;

/** A pool for comlink workers that is backed by p-queue to handle queueing and allocation. */
export class ComlinkPool<T, W extends object> {
  private readonly opts: ComlinkPoolOptions<T, W>;

  private readonly queue: PQueue;
  private readonly slots: Slot<T, W>[] = [];
  private readonly free: Slot<T, W>[] = [];

  public constructor(opts: ComlinkPoolOptions<T, W>) {
    this.opts = opts;
    this.queue = new PQueue({concurrency: opts.concurrency ?? 1});
  }

  /** Add a task to the queue */
  public add<V>(fn: PoolTask<T, V>): Promise<V> {
    const {free, queue} = this;
    return queue.add(async () => {
      let slot = this.free.shift();
      if (!slot) {
        const endpoint = this.opts.adapter.createEndpoint();
        const remote = this.opts.adapter.wrap(endpoint);
        this.slots.push((slot = {endpoint, remote}));
      }

      try {
        return await fn(slot.remote);
      } finally {
        free.push(slot);
      }
    });
  }

  /** Resolves when the queue is empty and all workers are idle */
  public onIdle(): Promise<void> {
    return this.queue.onIdle();
  }

  /** Resolves when the queue is empty (can be used for back pressure) */
  public onEmpty(): Promise<void> {
    return this.queue.onEmpty();
  }

  /** Resolves when the task is added to the queue. `done` property contains the actual result promise */
  public async addWhenSize<V>(size: number, fn: PoolTask<T, V>): Promise<{done: Promise<V>}> {
    if (!isFinite(size) || size < 0) throw new Error(`size must be more than zero`);
    return addWhenSize(this.queue, size, () => this.add(fn));
  }

  /** Returns the current size of the queue (could be 0 and still have work in progress) */
  public get size(): number {
    return this.queue.size;
  }

  public clearQueue() {
    this.queue.clear();
  }

  /** Terminate all endpoints */
  public async terminate(): Promise<void> {
    for (const {endpoint, remote} of this.slots) {
      try {
        await this.opts?.onBeforeDispose?.(remote, endpoint);
      } finally {
        await this.opts.adapter.terminate(endpoint);
      }
    }
  }

  /** Terminate all endpoints immediately (without orderly close handling) */
  public async terminateNow(): Promise<void> {
    return void (await Promise.all(this.slots.map((e) => this.opts.adapter.terminate?.(e.endpoint))));
  }

  /** Waits for idle and terminates workers */
  public async [Symbol.asyncDispose]() {
    await this.queue.onIdle().catch(() => {});
    await this.terminate();
  }
}

export async function addWhenSize<T>(queue: PQueue, size: number, cb: () => Promise<T>) {
  while (queue.size > size) {
    await new Promise((r) => queue.once('next', r));
  }
  return {done: queue.add(cb)};
}
