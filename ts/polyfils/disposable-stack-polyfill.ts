// Polyfill for DisposableStack and AsyncDisposableStack (TC39 Explicit Resource Management).
// Assumes Symbol.dispose and Symbol.asyncDispose already exist at runtime, and that the
// "esnext.disposable" (or "esnext") lib is enabled for the Disposable/SuppressedError types.
// Also provides a minimal SuppressedError if the runtime lacks one.

export {};

type Callback = () => unknown;

const SUPPRESSED_MSG = "An error was suppressed during disposal.";

const SuppressedErrorCtor: SuppressedErrorConstructor =
  typeof globalThis.SuppressedError === "function"
    ? globalThis.SuppressedError
    : (() => {
        class SuppressedError extends Error {
          declare error: unknown;
          declare suppressed: unknown;
          constructor(error: unknown, suppressed: unknown, message?: string) {
            super(message);
            Object.defineProperty(this, "error", { value: error, writable: true, configurable: true });
            Object.defineProperty(this, "suppressed", { value: suppressed, writable: true, configurable: true });
          }
        }
        Object.defineProperty(SuppressedError.prototype, "name", {
          value: "SuppressedError", writable: true, configurable: true,
        });
        Object.defineProperty(globalThis, "SuppressedError", {
          value: SuppressedError, writable: true, configurable: true,
        });
        return SuppressedError as unknown as SuppressedErrorConstructor;
      })();

function requireCallable(fn: unknown, what: string): asserts fn is Function {
  if (typeof fn !== "function") throw new TypeError(`${what} is not a function`);
}

function requireObject(value: unknown): asserts value is object {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    throw new TypeError("Disposable value must be an object, null, or undefined");
  }
}

interface DisposalState {
  hasError: boolean;
  error: unknown;
}

// Merge a new error into the running disposal error (newer error wraps older one).
function combine(state: DisposalState, err: unknown): void {
  if (state.hasError) {
    state.error = new SuppressedErrorCtor(err, state.error, SUPPRESSED_MSG);
  } else {
    state.error = err;
    state.hasError = true;
  }
}

function defineAlias(proto: object, symbol: symbol, name: string): void {
  Object.defineProperty(proto, symbol, {
    value: (proto as Record<string, unknown>)[name], writable: true, enumerable: false, configurable: true,
  });
}

function defineTag(proto: object, tag: string): void {
  Object.defineProperty(proto, Symbol.toStringTag, {
    value: tag, writable: false, enumerable: false, configurable: true,
  });
}

function installGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    value, writable: true, enumerable: false, configurable: true,
  });
}

// ---------------------------------------------------------------------------
// DisposableStack
// ---------------------------------------------------------------------------

class DisposableStackImpl implements DisposableStack {
  #disposed = false;
  #stack: Callback[] = [];

  declare readonly [Symbol.toStringTag]: string;
  declare [Symbol.dispose]: () => void;

  #assertNotDisposed(): void {
    if (this.#disposed) throw new ReferenceError("DisposableStack has already been disposed");
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  use<T extends Disposable | null | undefined>(value: T): T {
    this.#assertNotDisposed();
    if (value === null || value === undefined) return value;
    requireObject(value);
    const method: unknown = (value as Partial<Disposable>)[Symbol.dispose];
    requireCallable(method, "[Symbol.dispose]");
    this.#stack.push(() => { method.call(value); });
    return value;
  }

  adopt<T>(value: T, onDispose: (value: T) => void): T {
    this.#assertNotDisposed();
    requireCallable(onDispose, "onDispose");
    this.#stack.push(() => { onDispose.call(undefined, value); });
    return value;
  }

  defer(onDispose: () => void): void {
    this.#assertNotDisposed();
    requireCallable(onDispose, "onDispose");
    this.#stack.push(() => { onDispose.call(undefined); });
  }

  move(): DisposableStack {
    this.#assertNotDisposed();
    const next = new DisposableStackImpl();
    next.#stack = this.#stack;
    this.#stack = [];
    this.#disposed = true;
    return next;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const stack = this.#stack;
    this.#stack = [];
    const state: DisposalState = { hasError: false, error: undefined };
    for (let i = stack.length - 1; i >= 0; i--) {
      try {
        stack[i]();
      } catch (e) {
        combine(state, e);
      }
    }
    if (state.hasError) throw state.error;
  }
}

defineAlias(DisposableStackImpl.prototype, Symbol.dispose, "dispose");
defineTag(DisposableStackImpl.prototype, "DisposableStack");

if (typeof globalThis.DisposableStack !== "function") {
  installGlobal("DisposableStack", DisposableStackImpl);
}

// ---------------------------------------------------------------------------
// AsyncDisposableStack
// ---------------------------------------------------------------------------

// Returns a callback for the resource, or null for a null/undefined value
// (which is still recorded so disposal awaits once, per spec).
function getAsyncDisposer(value: unknown): Callback | null {
  if (value === null || value === undefined) return null;
  requireObject(value);
  const method: unknown = (value as Partial<AsyncDisposable>)[Symbol.asyncDispose];
  if (method === undefined || method === null) {
    const syncMethod: unknown = (value as Partial<Disposable>)[Symbol.dispose];
    requireCallable(syncMethod, "[Symbol.dispose]");
    // Sync fallback: call it, discard the result (don't await whatever it returns).
    return () => { syncMethod.call(value); return undefined; };
  }
  requireCallable(method, "[Symbol.asyncDispose]");
  return () => method.call(value);
}

class AsyncDisposableStackImpl implements AsyncDisposableStack {
  #disposed = false;
  #stack: (Callback | null)[] = []; // null = "just await"

  declare readonly [Symbol.toStringTag]: string;
  declare [Symbol.asyncDispose]: () => Promise<void>;

  #assertNotDisposed(): void {
    if (this.#disposed) throw new ReferenceError("AsyncDisposableStack has already been disposed");
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T {
    this.#assertNotDisposed();
    this.#stack.push(getAsyncDisposer(value));
    return value;
  }

  adopt<T>(value: T, onDisposeAsync: (value: T) => PromiseLike<void> | void): T {
    this.#assertNotDisposed();
    requireCallable(onDisposeAsync, "onDisposeAsync");
    this.#stack.push(() => onDisposeAsync.call(undefined, value));
    return value;
  }

  defer(onDisposeAsync: () => PromiseLike<void> | void): void {
    this.#assertNotDisposed();
    requireCallable(onDisposeAsync, "onDisposeAsync");
    this.#stack.push(() => onDisposeAsync.call(undefined));
  }

  move(): AsyncDisposableStack {
    this.#assertNotDisposed();
    const next = new AsyncDisposableStackImpl();
    next.#stack = this.#stack;
    this.#stack = [];
    this.#disposed = true;
    return next;
  }

  async disposeAsync(): Promise<void> {
    // Brand check: throws (-> rejection) if `this` isn't an AsyncDisposableStack.
    if (!(#disposed in this)) {
      throw new TypeError("AsyncDisposableStack.prototype.disposeAsync called on incompatible receiver");
    }
    if (this.#disposed) return;
    this.#disposed = true;
    const stack = this.#stack;
    this.#stack = [];
    const state: DisposalState = { hasError: false, error: undefined };
    for (let i = stack.length - 1; i >= 0; i--) {
      const fn = stack[i];
      try {
        await (fn === null ? undefined : fn());
      } catch (e) {
        combine(state, e);
      }
    }
    if (state.hasError) throw state.error;
  }
}

defineAlias(AsyncDisposableStackImpl.prototype, Symbol.asyncDispose, "disposeAsync");
defineTag(AsyncDisposableStackImpl.prototype, "AsyncDisposableStack");

if (typeof globalThis.AsyncDisposableStack !== "function") {
  installGlobal("AsyncDisposableStack", AsyncDisposableStackImpl);
}
