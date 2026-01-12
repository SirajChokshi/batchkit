import { BatchError } from './errors';
import { createIndexedMatcher, isIndexed, normalizeMatch } from './match';
import { microtask, wait } from './schedulers';
import { createTracer, registerBatcher } from './trace';
import type {
  Batcher,
  BatchFn,
  BatchOptions,
  GetOptions,
  Match,
  PendingRequest,
  Scheduler,
  TraceEvent,
} from './types';

export function batch<K, V>(
  fn: BatchFn<K, V>,
  match: Match<K, V>,
  options: BatchOptions<K> = {},
): Batcher<K, V> {
  const {
    wait: waitMs,
    schedule,
    max,
    key: keyFn = (k: K) => k,
    name,
    trace: traceHandler,
  } = options;

  const scheduler: Scheduler = schedule ?? (waitMs ? wait(waitMs) : microtask);

  let devtoolsEmitter: ((event: TraceEvent) => void) | undefined;
  const creationStack = new Error().stack;

  registerBatcher({ fn, name, stack: creationStack }, (emitter) => {
    devtoolsEmitter = emitter;
  });

  const tracer = createTracer(name, traceHandler, () => devtoolsEmitter);

  const matchFn = normalizeMatch(match);
  const isIndexedMatch = isIndexed(match);
  const indexedMatcher = isIndexedMatch ? createIndexedMatcher<K, V>() : null;

  let queue: PendingRequest<K, V>[] = [];
  const pendingKeys = new Set<unknown>();
  let cleanup: (() => void) | null = null;
  let isScheduled = false;
  let currentAbortController: AbortController | null = null;
  let inFlightRequests: PendingRequest<K, V>[] = [];

  function scheduleDispatch(): void {
    if (isScheduled || queue.length === 0) return;

    isScheduled = true;
    const batchId = tracer.nextBatchId();

    tracer.emit({
      type: 'schedule',
      batchId,
      size: queue.length,
    });

    cleanup = scheduler(() => {
      isScheduled = false;
      dispatch(batchId);
    });
  }

  async function dispatch(batchId?: string): Promise<void> {
    const activeQueue = queue.filter((req) => !req.aborted);

    if (activeQueue.length === 0) {
      queue = [];
      pendingKeys.clear();
      return;
    }

    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    isScheduled = false;

    const batch = activeQueue;
    queue = [];
    pendingKeys.clear();

    const chunks: PendingRequest<K, V>[][] = [];
    if (max && max > 0) {
      for (let i = 0; i < batch.length; i += max) {
        chunks.push(batch.slice(i, i + max));
      }
    } else {
      chunks.push(batch);
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkBatchId =
        i === 0 ? (batchId ?? tracer.nextBatchId()) : tracer.nextBatchId();
      await processChunk(chunks[i], chunkBatchId);
    }
  }

  async function processChunk(
    chunk: PendingRequest<K, V>[],
    batchId: string,
  ): Promise<void> {
    const keyToRequests = new Map<unknown, PendingRequest<K, V>[]>();
    const uniqueKeys: K[] = [];

    for (const request of chunk) {
      if (request.aborted) continue;

      const cacheKey = keyFn(request.key);

      let requests = keyToRequests.get(cacheKey);
      if (!requests) {
        requests = [];
        keyToRequests.set(cacheKey, requests);
        uniqueKeys.push(request.key);
      }
      requests.push(request);
    }

    if (uniqueKeys.length === 0) return;

    inFlightRequests = chunk;

    tracer.emit({
      type: 'dispatch',
      batchId,
      keys: uniqueKeys,
    });

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    const startedAt = performance.now();

    try {
      const results = await fn(uniqueKeys, signal);

      const duration = performance.now() - startedAt;

      if (signal.aborted) {
        tracer.emit({ type: 'abort', batchId });
        for (const requests of keyToRequests.values()) {
          for (const request of requests) {
            if (!request.aborted) {
              request.aborted = true;
              request.reject(new DOMException('Aborted', 'AbortError'));
            }
          }
        }
        return;
      }

      tracer.emit({
        type: 'resolve',
        batchId,
        duration,
      });

      if (isIndexedMatch && indexedMatcher) {
        const recordResults = results as Record<string, V>;
        for (const key of uniqueKeys) {
          const cacheKey = keyFn(key);
          const requests = keyToRequests.get(cacheKey);
          if (!requests) continue;
          const value = indexedMatcher(recordResults, key);

          for (const request of requests) {
            if (request.aborted) continue;
            if (value === undefined) {
              request.reject(
                new BatchError(`No result for key: ${String(key)}`),
              );
            } else {
              request.resolve(value);
            }
          }
        }
      } else if (matchFn) {
        const arrayResults = results as V[];

        if (!Array.isArray(arrayResults)) {
          throw new BatchError(
            'Batch function returned a non-array result. Use `indexed` for Record responses.',
          );
        }

        for (const key of uniqueKeys) {
          const cacheKey = keyFn(key);
          const requests = keyToRequests.get(cacheKey);
          if (!requests) continue;
          const value = matchFn(arrayResults, key);

          for (const request of requests) {
            if (request.aborted) continue;
            if (value === undefined) {
              request.reject(
                new BatchError(`No result for key: ${String(key)}`),
              );
            } else {
              request.resolve(value);
            }
          }
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (err.name === 'AbortError' || signal.aborted) {
        tracer.emit({ type: 'abort', batchId });
      } else {
        tracer.emit({
          type: 'error',
          batchId,
          error: err,
        });
      }

      for (const requests of keyToRequests.values()) {
        for (const request of requests) {
          if (!request.aborted) {
            request.reject(err);
          }
        }
      }
    } finally {
      currentAbortController = null;
      inFlightRequests = [];
    }
  }

  function getSingle(key: K, options?: GetOptions): Promise<V> {
    const externalSignal = options?.signal;

    tracer.emit({ type: 'get', key });

    if (externalSignal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    const cacheKey = keyFn(key);

    if (pendingKeys.has(cacheKey)) {
      tracer.emit({ type: 'dedup', key });
    } else {
      pendingKeys.add(cacheKey);
    }

    return new Promise<V>((resolvePromise, rejectPromise) => {
      let settled = false;
      let removeAbortListener: (() => void) | null = null;

      const resolve = (value: V) => {
        if (settled) return;
        settled = true;
        removeAbortListener?.();
        resolvePromise(value);
      };

      const reject = (error: Error) => {
        if (settled) return;
        settled = true;
        removeAbortListener?.();
        rejectPromise(error);
      };

      const request: PendingRequest<K, V> = {
        key,
        resolve,
        reject,
        signal: externalSignal,
        aborted: false,
      };

      queue.push(request);

      if (externalSignal) {
        const onAbort = () => {
          request.aborted = true;
          reject(new DOMException('Aborted', 'AbortError'));

          const allPendingAborted = queue.every((r) => r.aborted);
          const allInFlightAborted =
            inFlightRequests.length > 0 &&
            inFlightRequests.every((r) => r.aborted);
          if (
            allPendingAborted &&
            allInFlightAborted &&
            currentAbortController
          ) {
            currentAbortController.abort();
          }
        };

        externalSignal.addEventListener('abort', onAbort, { once: true });
        removeAbortListener = () => {
          externalSignal.removeEventListener('abort', onAbort);
        };
      }

      scheduleDispatch();
    });
  }

  function get(key: K, options?: GetOptions): Promise<V>;
  function get(keys: K[], options?: GetOptions): Promise<V[]>;
  function get(keyOrKeys: K | K[], options?: GetOptions): Promise<V | V[]> {
    if (Array.isArray(keyOrKeys)) {
      return Promise.all(keyOrKeys.map((k) => getSingle(k, options)));
    }
    return getSingle(keyOrKeys, options);
  }

  async function flush(): Promise<void> {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    isScheduled = false;
    await dispatch();
  }

  function abort(): void {
    for (const request of queue) {
      if (!request.aborted) {
        request.aborted = true;
        request.reject(new DOMException('Aborted', 'AbortError'));
      }
    }

    for (const request of inFlightRequests) {
      if (!request.aborted) {
        request.aborted = true;
        request.reject(new DOMException('Aborted', 'AbortError'));
      }
    }
    queue = [];
    pendingKeys.clear();

    if (currentAbortController) {
      currentAbortController.abort();
    }

    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    isScheduled = false;
  }

  return {
    get,
    flush,
    abort,
    name,
  };
}
