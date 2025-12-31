import type { BatcherTelemetry } from './telemetry'

/**
 * Information about a completed batch execution
 */
export interface BatchInfo<K, V> {
  /** Name of the batcher (if provided) */
  name?: string
  /** Keys that were batched together */
  keys: K[]
  /** Number of keys in the batch */
  size: number
  /** Time taken to resolve the batch in milliseconds */
  duration: number
  /** Results from the resolver */
  results: V[]
  /** Timestamp when the batch started */
  startedAt: number
  /** Timestamp when the batch completed */
  completedAt: number
}

/**
 * Information about a batch error
 */
export interface BatchErrorInfo<K> {
  /** Name of the batcher (if provided) */
  name?: string
  /** Keys that were in the failed batch */
  keys: K[]
  /** The error that occurred */
  error: Error
  /** Timestamp when the error occurred */
  timestamp: number
}

/**
 * A scheduler controls when batched keys are dispatched to the resolver.
 * It receives a dispatch function and should call it when ready.
 * Returns a cleanup function.
 */
export type Scheduler = (dispatch: () => void) => () => void

/**
 * Built-in scheduler types
 */
export type SchedulerType = 'microtask' | 'manual' | Scheduler

/**
 * Options for creating a batcher
 */
export interface BatcherOptions<K, V> {
  /**
   * The batch resolver function.
   * Receives an array of keys and must return an array of results
   * in the same order as the input keys.
   */
  resolver: (keys: K[]) => Promise<V[]>

  /**
   * Optional name for the batcher (useful for debugging/observability)
   */
  name?: string

  /**
   * Scheduling strategy for batching.
   * - 'microtask': Batches within a single event loop tick (default)
   * - 'manual': Only dispatches when .dispatch() is called
   * - Custom scheduler function
   */
  scheduler?: SchedulerType

  /**
   * Maximum number of keys to include in a single batch.
   * If more keys are queued, they will be split into multiple batches.
   */
  maxBatchSize?: number

  /**
   * Custom key function for deduplication.
   * Defaults to using the key directly.
   */
  keyFn?: (key: K) => unknown

  /**
   * Called after each successful batch execution
   */
  onBatch?: (info: BatchInfo<K, V>) => void

  /**
   * Called when a batch fails with an error
   */
  onError?: (info: BatchErrorInfo<K>) => void

  /**
   * Enable telemetry for debugging and visualization.
   * When enabled, the batcher will emit events for all operations.
   * Access via batcher._telemetry
   * @internal
   */
  _enableTelemetry?: boolean
}

/**
 * A pending request waiting to be batched
 */
export interface PendingRequest<K, V> {
  key: K
  resolve: (value: V) => void
  reject: (error: Error) => void
}

/**
 * The batcher instance returned by createBatcher
 */
export interface Batcher<K, V> {
  /**
   * Load a single value by key.
   * The call will be batched with other calls in the same tick.
   */
  load: (key: K) => Promise<V>

  /**
   * Load multiple values by keys.
   * All keys will be included in the same batch.
   */
  loadMany: (keys: K[]) => Promise<V[]>

  /**
   * Pre-populate the batcher with a known value.
   * Future loads for this key will return the primed value.
   */
  prime: (key: K, value: V) => void

  /**
   * Clear a specific key from the cache.
   */
  clear: (key: K) => void

  /**
   * Clear all cached values.
   */
  clearAll: () => void

  /**
   * Manually dispatch any pending requests.
   * Useful with the 'manual' scheduler.
   */
  dispatch: () => Promise<void>

  /**
   * The name of this batcher (if provided)
   */
  readonly name?: string

  /**
   * Telemetry interface for debugging and visualization.
   * Only active when _enableTelemetry is true.
   * @internal
   */
  readonly _telemetry: BatcherTelemetry<K, V>
}

/**
 * Error class for batch-level errors
 */
export class BatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BatchError'
  }
}

/**
 * Error returned for individual items that failed within a batch
 */
export class ItemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ItemError'
  }
}

/**
 * Options for the window scheduler
 */
export interface WindowSchedulerOptions {
  /** Time to wait before dispatching (in milliseconds) */
  wait: number
}

