import type { TraceEvent, TraceEventData, TraceHandler } from './types';

export interface DevtoolsHook {
  onBatcherCreated(info: {
    fn: { toString(): string };
    name: string | undefined;
    stack: string | undefined;
  }): ((event: TraceEvent) => void) | undefined;
}

let devtoolsHook: DevtoolsHook | null = null;

export function __setDevtoolsHook(hook: DevtoolsHook | null): void {
  devtoolsHook = hook;
}

export function hasDevtoolsHook(): boolean {
  return devtoolsHook != null;
}

export function registerBatcher(
  info: {
    fn: { toString(): string };
    name: string | undefined;
    stack: string | undefined;
  },
  setEmitter: (emitter: ((event: TraceEvent) => void) | undefined) => void,
): void {
  if (devtoolsHook) {
    const emitter = devtoolsHook.onBatcherCreated(info);
    setEmitter(emitter);
  }
}

export function createTracer<K>(
  name: string | undefined,
  handler: TraceHandler<K> | undefined,
  getDevtoolsEmitter:
    | (() => ((event: TraceEvent<K>) => void) | undefined)
    | undefined,
) {
  let batchCounter = 0;

  function emit(event: TraceEventData<K>) {
    const devtoolsEmitter = getDevtoolsEmitter?.();
    if (!handler && !devtoolsEmitter) return;

    const timestamp = performance.now();
    const fullEvent = {
      ...event,
      timestamp,
    } as TraceEvent<K>;
    handler?.(fullEvent);
    devtoolsEmitter?.(fullEvent);
  }

  function nextBatchId(): string {
    return `${name ?? 'batch'}-${++batchCounter}`;
  }

  return { emit, nextBatchId };
}
