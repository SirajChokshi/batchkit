import type { TraceEvent, TraceEventData, TraceHandler } from './types';

export interface DevtoolsHook {
  onBatcherCreated(info: {
    fn: { toString(): string };
    name: string | undefined;
    stack: string | undefined;
  }): ((event: TraceEvent) => void) | undefined;
}

interface PendingBatcher {
  fn: { toString(): string };
  name: string | undefined;
  stack: string | undefined;
  setEmitter: (emitter: ((event: TraceEvent) => void) | undefined) => void;
}

let devtoolsHook: DevtoolsHook | null = null;
const pendingBatchers: PendingBatcher[] = [];

export function __setDevtoolsHook(hook: DevtoolsHook | null): void {
  devtoolsHook = hook;

  if (hook && pendingBatchers.length > 0) {
    for (const pending of pendingBatchers) {
      const emitter = hook.onBatcherCreated({
        fn: pending.fn,
        name: pending.name,
        stack: pending.stack,
      });
      pending.setEmitter(emitter);
    }
    pendingBatchers.length = 0;
  } else if (!hook) {
    // clear pending batchers when hook is remove
    pendingBatchers.length = 0;
  }
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
  } else {
    pendingBatchers.push({ ...info, setEmitter });
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
    const timestamp = performance.now();
    const fullEvent = {
      ...event,
      timestamp,
    } as TraceEvent<K>;

    if (handler) {
      handler(fullEvent);
    }

    const devtoolsEmitter = getDevtoolsEmitter?.();
    if (devtoolsEmitter) {
      devtoolsEmitter(fullEvent);
    }
  }

  function nextBatchId(): string {
    return `${name ?? 'batch'}-${++batchCounter}`;
  }

  return { emit, nextBatchId };
}
