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

export function getDevtoolsHook(): DevtoolsHook | null {
  return devtoolsHook;
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
