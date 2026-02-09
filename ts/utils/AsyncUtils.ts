export interface SleepPromise extends Promise<void>, Disposable {
  abort(): void;
  unref(): SleepPromise;
  resolveNow(): void;
}

export interface SleepOptions {
  signal?: AbortSignal;
  unref?: boolean;
}

export function sleep(ms?: number): SleepPromise;
export function sleep(ms: number, opts?: SleepOptions): SleepPromise;
export function sleep(ms: number, unref: boolean): SleepPromise;
export function sleep(ms: number = 0, opts: boolean | SleepOptions = {}): SleepPromise {
  if (typeof opts === 'boolean') opts = {unref: opts};
  let to: NodeJS.Timer | number;
  let eR: () => void;
  const promise: any = new Promise<void>((r) => {
    const _timer = setTimeout((eR = r), ms);
    if (opts?.unref) _timer.unref?.();
    return (to = _timer);
  });
  promise.abort = () => clearTimeout(to as any);
  promise.resolveNow = () => (clearTimeout(to as any), eR());
  promise.unref = (): SleepPromise => ((to as NodeJS.Timer)?.unref?.(), promise);
  promise[Symbol.dispose] = () => (promise.unref(), promise.abort());
  opts.signal?.addEventListener('abort', promise.abort);
  return promise;
}

export type RetryAttemptHandler<T> = (promise: Promise<T>, attemptIndex: number) => unknown;

export interface RetryConfig<T> {
  /**
   *  'error' if retry on rejection
   *  'falsey' if retry on falsey resolved value
   *  'nullish' if retry on null/undefined
   *  callback(SettledResult) - return truthy if we need to retry
   */
  on: 'error' | 'falsey' | 'nullish' | ((r: PromiseSettledResult<T>) => unknown);
  /** A brief description of what is being done e.g. 'Check if File "X" exists' */
  title?: string;
  /** Fires before each attempt (this function's result will be awaited prior to the actual attempt) */
  onBeforeAttempt?: (attemptIndex: number) => unknown;
  /** Fires after each attempt (synchronously) */
  onAttempted?: RetryAttemptHandler<T>;
  /** handler for each rejection */
  onReject?: (reason: unknown, attempt: number) => void | Promise<unknown>;
  /** handler for each resolved value (but must retry) */
  onResolve?: (reason: unknown, attempt: number) => void | Promise<unknown>;
  /** Number of times to RE-try the call, e.g. 3 retries = 4 total attempts (default=Infinity) */
  retries?: number;
  /** Interval between calls. If an array, goes up the array until the last element (default=0) */
  interval?: number | number[] | ((retryIndex: number) => number);
  /** Total time limit (default=Infinity) */
  timeout?: number;
  /** The retry is stopped immediately if signaled */
  signal?: AbortSignal;
  /** If true, the retry loop does not keep the node process alive (default=false) */
  unref?: boolean;
  /** If true and signal aborts, will return a promise that never resolves */
  unresolveOnAbort?: boolean;
}

export interface RetryConfigWithFalsey<T> extends RetryConfig<T> {
  on: 'falsey';
}

/** @param attempts 0-based attempt index; first try is 0, first retry is 1 */
type RetryAction<T> = (i: number) => Promise<T>;

export interface RetryConfigWithAction<T> extends RetryConfig<T> {
  /** The retryable function to perform */
  action: RetryAction<T>;
}

export interface RetryConfigWithActionWithFalsey<T> extends RetryConfigWithFalsey<T> {
  /** The retryable function to perform */
  action: () => Promise<T | null | undefined>;
}

export type RetryConfigObject<T> =
  | RetryConfig<T> //
  | RetryConfigWithFalsey<T>
  | RetryConfigWithAction<T>
  | RetryConfigWithActionWithFalsey<T>;

export type RetryParams<T> = RetryConfigObject<T> | RetryAction<T>;

export async function retry<T>(opts: RetryConfigWithAction<T>): Promise<T>;
export async function retry<T>(opts: RetryConfigWithActionWithFalsey<T>): Promise<T>;
export async function retry<T>(fn: RetryAction<T | null | undefined>, opts: RetryConfigWithFalsey<T>): Promise<T>;
export async function retry<T>(fn: RetryAction<T>, opts: RetryConfig<T>): Promise<T>;
export async function retry<T>(arg0: RetryParams<T>, arg1?: RetryParams<T>): Promise<T> {
  let opts = [arg0, arg1].find((e): e is RetryConfigObject<T> => !!e && typeof e === 'object');
  if (!opts) throw new Error('options object must be defined');

  let fn = [arg0, arg1].find((e) => typeof e === 'function');
  if (!fn) fn = (arg0 as RetryConfigWithAction<T>)?.action;
  if (!fn) throw new Error('action function must be defined');

  const {retries = Infinity, interval = 0, timeout = Infinity, on = 'error', signal} = opts;

  const nextInterval =
    typeof interval === 'function' //
      ? interval
      : Array.isArray(interval)
        ? (i: number) => interval[Math.min(i, interval.length - 1)]
        : () => interval;

  const shouldRetry = (r: PromiseSettledResult<T>) => {
    if (typeof on === 'function') return on(r);
    if (on === 'falsey') return r.status === 'fulfilled' && !r.value;
    if (on === 'nullish') return r.status === 'fulfilled' && r.value == null;
    if (on === 'error') return r.status === 'rejected';
  };

  // handle abort signal
  let sp: SleepPromise | undefined;
  const res = () => sp?.resolveNow();
  signal?.addEventListener('abort', res);

  // remove abort listener after done
  using ds = new DisposableStack();
  ds.adopt({}, () => signal?.removeEventListener('abort', res));

  const startTime = Date.now();
  for (let i = 0; ; i++) {
    if (!opts.unresolveOnAbort) signal?.throwIfAborted();
    else if (signal?.aborted) return new Promise<any>(() => {});

    if (opts.onBeforeAttempt) await opts.onBeforeAttempt(i);
    const promise = fn(i);
    opts.onAttempted?.(promise, i);
    const [r] = await Promise.allSettled([promise]);

    // call result handlers if present (usually for logging)
    await (r.status === 'rejected' ? opts.onReject?.(r.reason, i) : opts.onResolve?.(r.value, i));

    // do we need to retry?
    if (!(await shouldRetry(r))) {
      if (r.status === 'rejected') throw r.reason;
      return r.value;
    }

    // if exceeded retry attempts, throw
    if (i + 1 > retries) {
      throw new Error(`Retry limit reached after ${i + 1} attempts (${Date.now() - startTime}ms)`);
    }

    // if we exceeded time (or will after interval), throw
    if (Date.now() > startTime + timeout) {
      throw new Error(`Timeout exceeded (${Date.now() - startTime}ms)`);
    }
    const nextWait = nextInterval(i);
    if (Date.now() + nextWait > startTime + timeout) {
      throw new Error(`Timeout would be exceeded before next attempt (${Date.now() - startTime}ms elapsed)`);
    }
    await (sp = sleep(nextWait, !!opts.unref));
  }
}
