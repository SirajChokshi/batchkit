import type { TraceEvent, TraceEventData, TraceHandler } from './types';

/**
 * Create a trace emitter for a batcher.
 */
export function createTracer<K>(
  name: string | undefined,
  handler: TraceHandler<K> | undefined,
) {
  let batchCounter = 0;

  function emit(event: TraceEventData<K>) {
    if (!handler) return;

    const fullEvent = {
      ...event,
      timestamp: performance.now(),
    } as TraceEvent<K>;

    handler(fullEvent);
  }

  function nextBatchId(): string {
    return `${name ?? 'batch'}-${++batchCounter}`;
  }

  return { emit, nextBatchId };
}
