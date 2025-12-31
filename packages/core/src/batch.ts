import { BatchError } from './errors';
import { createIndexedMatcher, isIndexed, normalizeMatch } from './match';
import { microtask, wait } from './schedulers';
import { createTracer } from './trace';
import type {
  Batcher,
  BatchFn,
  BatchOptions,
  GetOptions,
  Match,
  PendingRequest,
  Scheduler,
} from './types';

/**
 * Create a batcher that automatically batches individual requests.
 *
 * @param fn - The batch function that fetches multiple items at once
 * @param match - How to match results back to their requested keys
 * @param options - Optional configuration
 * @returns A batcher instance
 *
 * @example
 * ```ts
 * // Simple usage
 * const users = batch(
 *   (ids) => db.users.findMany({ where: { id: { in: ids } } }),
 *   'id'
 * )
 *
 * const user = await users.get(1)
 * const many = await users.get([1, 2, 3])
 * ```
 */
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

  // Determine scheduler
  const scheduler: Scheduler = schedule ?? (waitMs ? wait(waitMs) : microtask);

  // Setup tracing
  const tracer = createTracer(name, traceHandler);

  // Match function setup
  const matchFn = normalizeMatch(match);
  const isIndexedMatch = isIndexed(match);
  const indexedMatcher = isIndexedMatch ? createIndexedMatcher<K, V>() : null;

  // State
  let queue: PendingRequest<K, V>[] = [];
  const pendingKeys = new Set<unknown>();
  let cleanup: (() => void) | null = null;
  let isScheduled = false;
  let currentAbortController: AbortController | null = null;

  /**
   * Schedule a dispatch if not already scheduled.
   */
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

  /**
   * Dispatch all pending requests.
   */
  async function dispatch(batchId?: string): Promise<void> {
    // Filter out aborted requests
    const activeQueue = queue.filter((req) => !req.aborted);

    if (activeQueue.length === 0) {
      queue = [];
      pendingKeys.clear();
      return;
    }

    // Clean up scheduler
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    isScheduled = false;

    // Take snapshot of current queue
    const batch = activeQueue;
    queue = [];
    pendingKeys.clear();

    // Handle max batch size by splitting into chunks
    const chunks: PendingRequest<K, V>[][] = [];
    if (max && max > 0) {
      for (let i = 0; i < batch.length; i += max) {
        chunks.push(batch.slice(i, i + max));
      }
    } else {
      chunks.push(batch);
    }

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      // first chunk uses the scheduled batchId; subsequent chunks get new IDs
      const chunkBatchId =
        i === 0 ? (batchId ?? tracer.nextBatchId()) : tracer.nextBatchId();
      await processChunk(chunks[i], chunkBatchId);
    }
  }

  /**
   * Process a single chunk of requests.
   */
  async function processChunk(
    chunk: PendingRequest<K, V>[],
    batchId: string,
  ): Promise<void> {
    // Deduplicate keys while preserving request order
    const keyToRequests = new Map<unknown, PendingRequest<K, V>[]>();
    const uniqueKeys: K[] = [];

    for (const request of chunk) {
      if (request.aborted) continue;

      const cacheKey = keyFn(request.key);

      if (!keyToRequests.has(cacheKey)) {
        keyToRequests.set(cacheKey, []);
        uniqueKeys.push(request.key);
      }
      keyToRequests.get(cacheKey)!.push(request);
    }

    if (uniqueKeys.length === 0) return;

    tracer.emit({
      type: 'dispatch',
      batchId,
      keys: uniqueKeys,
    });

    // Create abort controller for this batch
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    const startedAt = performance.now();

    try {
      // Call the batch function
      const results = await fn(uniqueKeys, signal);

      const duration = performance.now() - startedAt;

      // Check if aborted during execution
      if (signal.aborted) {
        tracer.emit({ type: 'abort', batchId });
        return;
      }

      tracer.emit({
        type: 'resolve',
        batchId,
        duration,
      });

      // Distribute results
      if (isIndexedMatch && indexedMatcher) {
        // Results are a Record
        const recordResults = results as Record<string, V>;
        for (const key of uniqueKeys) {
          const cacheKey = keyFn(key);
          const requests = keyToRequests.get(cacheKey)!;
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
        // Results are an array
        const arrayResults = results as V[];

        // Validate result is an array
        if (!Array.isArray(arrayResults)) {
          throw new BatchError(
            'Batch function returned a non-array result. Use `indexed` for Record responses.',
          );
        }

        for (const key of uniqueKeys) {
          const cacheKey = keyFn(key);
          const requests = keyToRequests.get(cacheKey)!;
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

      // Check if this is an abort
      if (err.name === 'AbortError' || signal.aborted) {
        tracer.emit({ type: 'abort', batchId });
      } else {
        tracer.emit({
          type: 'error',
          batchId,
          error: err,
        });
      }

      // Reject all pending requests
      for (const requests of keyToRequests.values()) {
        for (const request of requests) {
          if (!request.aborted) {
            request.reject(err);
          }
        }
      }
    } finally {
      currentAbortController = null;
    }
  }

  /**
   * Get a single item by key.
   */
  function getSingle(key: K, options?: GetOptions): Promise<V> {
    const externalSignal = options?.signal;

    tracer.emit({ type: 'get', key });

    // Check if already aborted
    if (externalSignal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    const cacheKey = keyFn(key);

    // Check for dedup
    if (pendingKeys.has(cacheKey)) {
      tracer.emit({ type: 'dedup', key });
    } else {
      pendingKeys.add(cacheKey);
    }

    return new Promise<V>((resolve, reject) => {
      const request: PendingRequest<K, V> = {
        key,
        resolve,
        reject,
        signal: externalSignal,
        aborted: false,
      };

      queue.push(request);

      // Handle per-request abort
      if (externalSignal) {
        const onAbort = () => {
          request.aborted = true;
          reject(new DOMException('Aborted', 'AbortError'));

          // Check if all requests are aborted - abort the batch
          const allAborted = queue.every((r) => r.aborted);
          if (allAborted && currentAbortController) {
            currentAbortController.abort();
          }
        };

        externalSignal.addEventListener('abort', onAbort, { once: true });
      }

      scheduleDispatch();
    });
  }

  /**
   * Get implementation with overloading.
   */
  function get(key: K, options?: GetOptions): Promise<V>;
  function get(keys: K[], options?: GetOptions): Promise<V[]>;
  function get(keyOrKeys: K | K[], options?: GetOptions): Promise<V | V[]> {
    if (Array.isArray(keyOrKeys)) {
      return Promise.all(keyOrKeys.map((k) => getSingle(k, options)));
    }
    return getSingle(keyOrKeys, options);
  }

  /**
   * Execute pending batch immediately.
   */
  async function flush(): Promise<void> {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    isScheduled = false;
    await dispatch();
  }

  /**
   * Abort in-flight batch.
   */
  function abort(): void {
    // Mark all pending as aborted
    for (const request of queue) {
      request.aborted = true;
      request.reject(new DOMException('Aborted', 'AbortError'));
    }
    queue = [];
    pendingKeys.clear();

    // Abort current in-flight request
    if (currentAbortController) {
      currentAbortController.abort();
    }

    // Clean up scheduler
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
