import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

// Where drag events are listened for and where the overlay is drawn.
// Omit for document.body / the whole viewport.
export type DropTarget = RefObject<HTMLElement | null> | HTMLElement | string;

export interface DropZoneOptions {
  target?: DropTarget;
  /** Decide whether a given drag is interesting. Default: it carries files. */
  accept?: (dt: DataTransfer) => boolean;
  disabled?: boolean;
  /** Fires when the effective active state changes (already accounts for nested zones). */
  onActiveChange?: (active: boolean) => void;
  /** Files dropped on the target. The raw event is included for non-file payloads. */
  onDrop?: (files: File[], e: DragEvent) => void;
}

export interface DropZoneState {
  active: boolean;
  targetEl: HTMLElement | null;
}

const acceptFiles = (dt: DataTransfer) => Array.from(dt.types).includes('Files');

// See onMouse below. Well above the ~50ms cadence of dragover while moving.
const MOUSE_GRACE_MS = 150;

function resolveTarget(target?: DropTarget): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (target == null) return document.body;
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target);
  if (target instanceof HTMLElement) return target;
  return target.current ?? null;
}

// Module-level registry of targets currently being dragged over. Lets an outer
// zone (e.g. body) step aside while an inner zone (e.g. a panel) is active.
const activeTargets = new Set<HTMLElement>();
const subscribers = new Set<() => void>();
let registryVersion = 0;

function setTargetActive(el: HTMLElement, on: boolean) {
  if (activeTargets.has(el) === on) return;
  if (on) activeTargets.add(el);
  else activeTargets.delete(el);
  registryVersion++;
  subscribers.forEach((fn) => fn());
}

// Re-renders the caller whenever the registry changes (React 16 compatible).
function useRegistryVersion() {
  const [, setVersion] = useState(registryVersion);
  useEffect(() => {
    const fn = () => setVersion(registryVersion);
    subscribers.add(fn);
    fn(); // catch changes that happened between render and subscribe
    return () => {
      subscribers.delete(fn);
    };
  }, []);
}

function hasActiveDescendant(el: HTMLElement) {
  for (const other of activeTargets) {
    if (other !== el && el.contains(other)) return true;
  }
  return false;
}

// Drop events bubble from the inner zone to the outer one. The inner zone marks
// the event so the outer zone knows not to fire its own onDrop.
const handledDrops = new WeakSet<Event>();

export function useDropZone(opts: DropZoneOptions = {}): DropZoneState {
  const { target, disabled = false } = opts;
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [rawActive, setRawActive] = useState(false);

  // Callbacks live in a ref so parent re-renders don't re-attach listeners.
  const latest = useRef(opts);
  latest.current = opts;

  // Effect cleanup also runs on unmount; React 16 warns if we setState then.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Resolve after mount (SSR-safe). Runs each render so a selector that matches
  // nothing yet gets picked up later; setState bails out when unchanged.
  useEffect(() => {
    setTargetEl(resolveTarget(target));
  });

  useEffect(() => {
    if (!targetEl || disabled) return;

    // body doesn't always cover the viewport, so listen on document instead
    const isBody = targetEl === document.body;
    const listenEl: EventTarget = isBody ? document : targetEl;
    const scope: HTMLElement = isBody ? document.documentElement : targetEl;

    // Every element the pointer has entered and not yet left. A set rather
    // than a counter: Firefox can fire dragenter twice for one element, and an
    // element removed from the DOM mid-drag never fires dragleave, so stale
    // entries are pruned instead of being counted forever.
    const entered = new Set<EventTarget>();
    let deactivateTimer: number | undefined;
    let lastDragEventAt = 0;

    const cancelDeactivate = () => {
      window.clearTimeout(deactivateTimer);
      deactivateTimer = undefined;
    };
    const reset = () => {
      entered.clear();
      cancelDeactivate();
      if (mounted.current) setRawActive(false);
    };
    const activate = () => {
      cancelDeactivate();
      setRawActive(true);
    };
    // Crossing a child boundary fires dragleave for the parent before
    // dragenter for the child (or vice versa, in Firefox). Deferring the
    // deactivation by a tick lets the matching enter cancel it, so the overlay
    // doesn't blink at every element edge.
    const scheduleDeactivate = () => {
      if (deactivateTimer !== undefined) return;
      deactivateTimer = window.setTimeout(() => {
        deactivateTimer = undefined;
        if (entered.size === 0) setRawActive(false);
      }, 0);
    };
    const prune = () => {
      entered.forEach((t) => {
        if (!(t instanceof Node) || !scope.contains(t)) entered.delete(t);
      });
    };
    const accepts = (e: DragEvent) => {
      if (!e.dataTransfer || !(latest.current.accept ?? acceptFiles)(e.dataTransfer)) return false;
      lastDragEventAt = Date.now();
      return true;
    };

    const onEnter = (e: DragEvent) => {
      if (!accepts(e)) return;
      if (e.target) entered.add(e.target);
      activate();
    };
    const onOver = (e: DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault(); // without this the browser refuses the drop
      e.dataTransfer!.dropEffect = 'copy';
      // If listeners were (re)attached mid-drag, dragenter already happened
      // and won't fire again, so treat a dragover with no entries as an enter.
      if (entered.size === 0 && e.target) entered.add(e.target);
      activate();
    };
    const onLeave = (e: DragEvent) => {
      if (!accepts(e)) return;
      if (e.target) entered.delete(e.target);
      prune();
      if (entered.size === 0) scheduleDeactivate();
    };
    const onDrop = (e: DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault(); // stop the browser navigating to the file
      reset();
      if (handledDrops.has(e)) return; // an inner zone already took it
      handledDrops.add(e);
      latest.current.onDrop?.(Array.from(e.dataTransfer?.files ?? []), e);
    };

    // dragend never fires for OS file drags, so Esc or dropping outside the
    // window can leave us stuck "active". Mouse events are suppressed while a
    // drag is in progress, so one arriving means the drag ended. The grace
    // window ignores the stray mousemove some browsers emit right around drag
    // start, when it would be interleaved with drag events.
    const onMouse = () => {
      if (entered.size > 0 && Date.now() - lastDragEventAt > MOUSE_GRACE_MS) reset();
    };

    listenEl.addEventListener('dragenter', onEnter as EventListener);
    listenEl.addEventListener('dragover', onOver as EventListener);
    listenEl.addEventListener('dragleave', onLeave as EventListener);
    listenEl.addEventListener('drop', onDrop as EventListener);
    document.addEventListener('dragend', reset); // covers in-page HTML5 drags
    document.addEventListener('mousemove', onMouse);
    document.addEventListener('mouseup', onMouse);

    return () => {
      listenEl.removeEventListener('dragenter', onEnter as EventListener);
      listenEl.removeEventListener('dragover', onOver as EventListener);
      listenEl.removeEventListener('dragleave', onLeave as EventListener);
      listenEl.removeEventListener('drop', onDrop as EventListener);
      document.removeEventListener('dragend', reset);
      document.removeEventListener('mousemove', onMouse);
      document.removeEventListener('mouseup', onMouse);
      reset();
    };
  }, [targetEl, disabled]);

  // Publish our raw state to the registry
  useEffect(() => {
    if (!targetEl) return;
    setTargetActive(targetEl, rawActive);
    return () => setTargetActive(targetEl, false);
  }, [targetEl, rawActive]);

  // Re-render whenever any zone's state changes so `active` stays correct
  useRegistryVersion();
  const active = rawActive && !!targetEl && !hasActiveDescendant(targetEl);

  const prevActive = useRef(active);
  useEffect(() => {
    if (prevActive.current === active) return;
    prevActive.current = active;
    latest.current.onActiveChange?.(active);
  }, [active]);

  return { active, targetEl };
}

type Rect = Pick<CSSProperties, 'top' | 'left' | 'width' | 'height'>;

// Tracks the target's viewport rect while the overlay is showing.
function useTargetRect(el: HTMLElement | null, enabled: boolean): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!el || !enabled) {
      setRect(null);
      return;
    }
    if (el === document.body) {
      setRect({ top: 0, left: 0, width: '100%', height: '100%' });
      return;
    }
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true); // capture: any scroll container
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [el, enabled]);

  return rect;
}

export interface DropOverlayProps extends DropZoneOptions {
  /** Replaces the default look; layout/positioning classes are always applied. */
  className?: string;
  zIndex?: number;
  /** Overlay content. Omit to use the component in handlers-only mode. */
  children?: ReactNode | ((state: { active: boolean }) => ReactNode);
}

// pointer-events-none is load-bearing: the overlay must be invisible to drag
// events so the depth counter isn't disturbed and the drop reaches the target.
const BASE_CLASSES = 'fixed pointer-events-none flex items-center justify-center';
const DEFAULT_LOOK =
  'bg-slate-900/60 text-white text-xl font-medium border-4 border-dashed border-white/70';

export function DropOverlay({ className, zIndex = 50, children, ...zone }: DropOverlayProps) {
  const { active, targetEl } = useDropZone(zone);
  const rect = useTargetRect(targetEl, active && children != null);

  if (!active || children == null || !rect) return null;

  return createPortal(
    <div
      aria-hidden
      className={`${BASE_CLASSES} ${className ?? DEFAULT_LOOK}`}
      style={{ zIndex, ...rect }}
    >
      {typeof children === 'function' ? children({ active }) : children}
    </div>,
    document.body,
  );
}
