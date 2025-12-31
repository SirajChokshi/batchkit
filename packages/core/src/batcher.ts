import type {
  Batcher,
  BatcherOptions,
  BatchInfo,
  BatchErrorInfo,
  PendingRequest,
  Scheduler,
  SchedulerType,
} from './types'
import { BatchError } from './types'
import { TelemetryEmitter, NoopTelemetry } from './telemetry'
import type { BatcherTelemetry } from './telemetry'

let batcherIdCounter = 0

/**
 * Microtask scheduler - batches within a single event loop tick
 */
const microtaskScheduler: Scheduler = (dispatch) => {
  let scheduled = false

  // We use queueMicrotask to batch all calls within the same tick
  if (!scheduled) {
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      dispatch()
    })
  }

  return () => {
    scheduled = false
  }
}

/**
 * Manual scheduler - only dispatches when .dispatch() is called
 */
const manualScheduler: Scheduler = () => {
  // No-op - dispatch must be called manually
  return () => { }
}

/**
 * Resolve the scheduler from options
 */
function resolveScheduler(scheduler: SchedulerType | undefined): Scheduler {
  if (scheduler === undefined || scheduler === 'microtask') {
    return microtaskScheduler
  }
  if (scheduler === 'manual') {
    return manualScheduler
  }
  return scheduler
}

/**
 * Creates a new batcher instance
 */
export function createBatcher<K, V>(
  options: BatcherOptions<K, V>
): Batcher<K, V> {
  const {
    resolver,
    name,
    scheduler: schedulerOption,
    maxBatchSize,
    keyFn = (k: K) => k,
    onBatch,
    onError,
    _enableTelemetry = false,
  } = options

  const scheduler = resolveScheduler(schedulerOption)

  // Create telemetry emitter
  const batcherId = name ?? `batcher-${++batcherIdCounter}`
  const telemetry: TelemetryEmitter<K, V> | NoopTelemetry<K, V> = _enableTelemetry
    ? new TelemetryEmitter<K, V>(batcherId, true)
    : new NoopTelemetry<K, V>()

  // Queue of pending requests
  let queue: PendingRequest<K, V>[] = []

  // Track keys already in current batch (for dedup telemetry)
  const pendingKeys = new Set<unknown>()

  // Cache for primed values
  const cache = new Map<unknown, V>()

  // Cleanup function from current scheduler
  let cleanup: (() => void) | null = null

  // Track if a dispatch is scheduled
  let isScheduled = false

  /**
   * Schedule a dispatch if not already scheduled
   */
  function scheduleDispatch(): void {
    if (isScheduled || queue.length === 0) return

    isScheduled = true

    // Emit batch:scheduled event
    if (telemetry instanceof TelemetryEmitter) {
      telemetry.emit('batch:scheduled', {
        batchId: telemetry.nextBatchId(),
      })
    }

    cleanup = scheduler(() => {
      isScheduled = false
      dispatch()
    })
  }

  /**
   * Dispatch all pending requests
   */
  async function dispatch(): Promise<void> {
    if (queue.length === 0) return

    // Clean up scheduler
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    isScheduled = false

    // Take all pending requests
    const batch = queue
    queue = []
    pendingKeys.clear()

    // Handle max batch size by splitting into chunks
    const chunks: PendingRequest<K, V>[][] = []
    if (maxBatchSize && maxBatchSize > 0) {
      for (let i = 0; i < batch.length; i += maxBatchSize) {
        chunks.push(batch.slice(i, i + maxBatchSize))
      }
    } else {
      chunks.push(batch)
    }

    // Process each chunk
    for (const chunk of chunks) {
      await processChunk(chunk)
    }
  }

  /**
   * Process a single chunk of requests
   */
  async function processChunk(chunk: PendingRequest<K, V>[]): Promise<void> {
    // Deduplicate keys while preserving request order
    const keyToRequests = new Map<unknown, PendingRequest<K, V>[]>()
    const uniqueKeys: K[] = []

    for (const request of chunk) {
      const cacheKey = keyFn(request.key)

      // Check cache first
      if (cache.has(cacheKey)) {
        const cachedValue = cache.get(cacheKey)!
        request.resolve(cachedValue)

        // Emit load:cached event
        if (telemetry instanceof TelemetryEmitter) {
          telemetry.emit('load:cached', {
            key: request.key,
            value: cachedValue,
          })
        }
        continue
      }

      // Group requests by key for deduplication
      if (!keyToRequests.has(cacheKey)) {
        keyToRequests.set(cacheKey, [])
        uniqueKeys.push(request.key)
      }
      keyToRequests.get(cacheKey)!.push(request)
    }

    // If all requests were served from cache, we're done
    if (uniqueKeys.length === 0) return

    // Generate batch ID for this dispatch
    const batchId = telemetry instanceof TelemetryEmitter
      ? telemetry.nextBatchId()
      : 'batch'

    // Emit batch:dispatching event
    if (telemetry instanceof TelemetryEmitter) {
      telemetry.emit('batch:dispatching', {
        batchId,
        keys: uniqueKeys,
      })
    }

    const startedAt = performance.now()

    try {
      // Call the resolver with unique keys
      const results = await resolver(uniqueKeys)

      const completedAt = performance.now()
      const duration = completedAt - startedAt

      // Validate result length
      if (results.length !== uniqueKeys.length) {
        throw new BatchError(
          `Resolver returned ${results.length} results for ${uniqueKeys.length} keys. ` +
          `Results must be in the same order and length as input keys.`
        )
      }

      // Distribute results to all waiting requests
      for (let i = 0; i < uniqueKeys.length; i++) {
        const key = uniqueKeys[i]
        const cacheKey = keyFn(key)
        const result = results[i]
        const requests = keyToRequests.get(cacheKey)!

        // Check if result is an Error (per-item error handling)
        if (result instanceof Error) {
          for (const request of requests) {
            request.reject(result)
          }
        } else {
          for (const request of requests) {
            request.resolve(result)
          }
        }
      }

      // Emit batch:resolved event
      if (telemetry instanceof TelemetryEmitter) {
        telemetry.emit('batch:resolved', {
          batchId,
          keys: uniqueKeys,
          results,
          duration,
        })
      }

      // Call onBatch hook if provided
      if (onBatch) {
        const batchInfo: BatchInfo<K, V> = {
          name,
          keys: uniqueKeys,
          size: uniqueKeys.length,
          duration,
          results,
          startedAt,
          completedAt,
        }
        try {
          onBatch(batchInfo)
        } catch {
          // Ignore errors in hooks
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      // Reject all pending requests
      for (const requests of keyToRequests.values()) {
        for (const request of requests) {
          request.reject(err)
        }
      }

      // Emit batch:error event
      if (telemetry instanceof TelemetryEmitter) {
        telemetry.emit('batch:error', {
          batchId,
          keys: uniqueKeys,
          error: err,
        })
      }

      // Call onError hook if provided
      if (onError) {
        const errorInfo: BatchErrorInfo<K> = {
          name,
          keys: uniqueKeys,
          error: err,
          timestamp: Date.now(),
        }
        try {
          onError(errorInfo)
        } catch {
          // Ignore errors in hooks
        }
      }
    }
  }

  /**
   * Load a single value by key
   */
  function load(key: K): Promise<V> {
    const cacheKey = keyFn(key)

    // Emit load:called event
    if (telemetry instanceof TelemetryEmitter) {
      telemetry.emit('load:called', { key })
    }

    // Return cached value immediately
    if (cache.has(cacheKey)) {
      const cachedValue = cache.get(cacheKey)!

      // Emit load:cached event
      if (telemetry instanceof TelemetryEmitter) {
        telemetry.emit('load:cached', {
          key,
          value: cachedValue,
        })
      }

      return Promise.resolve(cachedValue)
    }

    // Check if this key is already pending (dedup)
    if (pendingKeys.has(cacheKey)) {
      // Emit load:deduped event
      if (telemetry instanceof TelemetryEmitter) {
        telemetry.emit('load:deduped', { key })
      }
    } else {
      pendingKeys.add(cacheKey)
    }

    return new Promise<V>((resolve, reject) => {
      queue.push({ key, resolve, reject })
      scheduleDispatch()
    })
  }

  /**
   * Load multiple values by keys
   */
  function loadMany(keys: K[]): Promise<V[]> {
    return Promise.all(keys.map(load))
  }

  /**
   * Prime the cache with a known value
   */
  function prime(key: K, value: V): void {
    const cacheKey = keyFn(key)
    cache.set(cacheKey, value)

    // Emit cache:primed event
    if (telemetry instanceof TelemetryEmitter) {
      telemetry.emit('cache:primed', { key, value })
    }
  }

  /**
   * Clear a specific key from the cache
   */
  function clear(key: K): void {
    const cacheKey = keyFn(key)
    cache.delete(cacheKey)

    // Emit cache:cleared event
    if (telemetry instanceof TelemetryEmitter) {
      telemetry.emit('cache:cleared', { key })
    }
  }

  /**
   * Clear all cached values
   */
  function clearAll(): void {
    cache.clear()

    // Emit cache:cleared-all event
    if (telemetry instanceof TelemetryEmitter) {
      telemetry.emit('cache:cleared-all', {})
    }
  }

  return {
    load,
    loadMany,
    prime,
    clear,
    clearAll,
    dispatch,
    name,
    _telemetry: telemetry as BatcherTelemetry<K, V>,
  }
}
