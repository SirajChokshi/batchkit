import type { TraceEvent, TraceEventData, TraceHandler } from './types';

interface DevtoolsRegistry {
  register(info: { name: string; registeredAt: number }): void;
  emit(name: string, event: unknown): void;
}

declare const window: { __BATCHKIT_DEVTOOLS__?: DevtoolsRegistry } | undefined;

function getDevtools(): DevtoolsRegistry | undefined {
  // biome-ignore lint/complexity/useOptionalChain: need typeof check for Node.js
  if (typeof window !== 'undefined' && window.__BATCHKIT_DEVTOOLS__) {
    return window.__BATCHKIT_DEVTOOLS__;
  }
  return undefined;
}

export function createTracer<K>(
  name: string | undefined,
  handler: TraceHandler<K> | undefined,
) {
  let batchCounter = 0;
  let registeredWithDevtools = false;

  function emit(event: TraceEventData<K>) {
    const timestamp = performance.now();

    const fullEvent = {
      ...event,
      timestamp,
    } as TraceEvent<K>;

    if (handler) {
      handler(fullEvent);
    }

    const devtools = getDevtools();
    if (devtools && name) {
      if (!registeredWithDevtools) {
        devtools.register({ name, registeredAt: timestamp });
        registeredWithDevtools = true;
      }
      devtools.emit(name, fullEvent);
    }
  }

  function nextBatchId(): string {
    return `${name ?? 'batch'}-${++batchCounter}`;
  }

  return { emit, nextBatchId };
}
