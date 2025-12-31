/**
 * The batch function that fetches multiple items at once.
 * Receives an array of keys and an AbortSignal for cancellation.
 */
export type BatchFn<K, V> = (
  keys: K[],
  signal: AbortSignal
) => Promise<V[] | Record<string, V>>

/**
 * How to match results back to their requested keys.
 * - String: match by field name (e.g., 'id')
 * - Symbol: use indexed matching for Record responses
 * - Function: custom matching logic
 */
export type Match<K, V> =
  | keyof V
  | symbol
  | MatchFn<K, V>

/**
 * Custom match function signature.
 */
export type MatchFn<K, V> = (results: V[], key: K) => V | undefined

/**
 * Match function for Record/indexed responses.
 */
export type IndexedMatchFn<K, V> = (results: Record<string, V>, key: K) => V | undefined

/**
 * Scheduler controls when batched keys are dispatched.
 * Receives a dispatch function and returns a cleanup function.
 */
export type Scheduler = (dispatch: () => void) => () => void

/**
 * Handler for trace events.
 */
export type TraceHandler<K = unknown> = (event: TraceEvent<K>) => void

/**
 * Trace event data without timestamp (used internally for emit calls).
 */
export type TraceEventData<K = unknown> =
  | { type: 'get'; key: K }
  | { type: 'dedup'; key: K }
  | { type: 'schedule'; batchId: string; size: number }
  | { type: 'dispatch'; batchId: string; keys: K[] }
  | { type: 'resolve'; batchId: string; duration: number }
  | { type: 'error'; batchId: string; error: Error }
  | { type: 'abort'; batchId: string }

/**
 * Trace events emitted during batch operations.
 * Each event includes a timestamp added by the tracer.
 */
export type TraceEvent<K = unknown> = TraceEventData<K> & { timestamp: number }

/**
 * Options for creating a batcher.
 */
export interface BatchOptions<K = unknown> {
  /**
   * Milliseconds to wait before dispatching (default: 0 = microtask).
   */
  wait?: number

  /**
   * Custom scheduler (overrides wait).
   */
  schedule?: Scheduler

  /**
   * Maximum batch size (default: unlimited).
   */
  max?: number

  /**
   * Custom key function for deduplication (default: identity).
   */
  key?: (k: K) => unknown

  /**
   * Name for tracing/debugging.
   */
  name?: string

  /**
   * Trace event handler.
   */
  trace?: TraceHandler<K>
}

/**
 * Options for the get() method.
 */
export interface GetOptions {
  /**
   * AbortSignal for per-request cancellation.
   */
  signal?: AbortSignal
}

/**
 * The batcher instance returned by batch().
 */
export interface Batcher<K, V> {
  /**
   * Get a single item by key.
   */
  get(key: K, options?: GetOptions): Promise<V>

  /**
   * Get multiple items by keys.
   */
  get(keys: K[], options?: GetOptions): Promise<V[]>

  /**
   * Execute pending batch immediately.
   */
  flush(): Promise<void>

  /**
   * Abort in-flight batch.
   */
  abort(): void

  /**
   * Name of this batcher (if provided).
   */
  readonly name?: string
}

/**
 * Internal pending request structure.
 */
export interface PendingRequest<K, V> {
  key: K
  resolve: (value: V) => void
  reject: (error: Error) => void
  signal?: AbortSignal
  aborted: boolean
}
