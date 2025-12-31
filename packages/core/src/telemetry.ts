/**
 * Telemetry system for batchkit debugging and visualization.
 * This is an internal API (prefixed with underscore) designed for
 * devtools, debuggers, and playground visualization.
 */

/**
 * All telemetry event types emitted by a batcher
 */
export interface TelemetryEventMap<K = unknown, V = unknown> {
  /** A load() call was made */
  'load:called': {
    key: K
    timestamp: number
    batcherId: string
  }

  /** A key was deduplicated (already in current batch) */
  'load:deduped': {
    key: K
    timestamp: number
    batcherId: string
  }

  /** A key was served from cache */
  'load:cached': {
    key: K
    value: V
    timestamp: number
    batcherId: string
  }

  /** A batch has been scheduled and is collecting keys */
  'batch:scheduled': {
    batchId: string
    timestamp: number
    batcherId: string
  }

  /** A batch is about to dispatch to the resolver */
  'batch:dispatching': {
    batchId: string
    keys: K[]
    timestamp: number
    batcherId: string
  }

  /** A batch resolved successfully */
  'batch:resolved': {
    batchId: string
    keys: K[]
    results: V[]
    duration: number
    timestamp: number
    batcherId: string
  }

  /** A batch failed with an error */
  'batch:error': {
    batchId: string
    keys: K[]
    error: Error
    timestamp: number
    batcherId: string
  }

  /** A value was primed into the cache */
  'cache:primed': {
    key: K
    value: V
    timestamp: number
    batcherId: string
  }

  /** A key was cleared from cache */
  'cache:cleared': {
    key: K
    timestamp: number
    batcherId: string
  }

  /** All cache was cleared */
  'cache:cleared-all': {
    timestamp: number
    batcherId: string
  }
}

/**
 * A single telemetry event with its type
 */
export type TelemetryEvent<K = unknown, V = unknown> = {
  [E in keyof TelemetryEventMap<K, V>]: {
    type: E
    data: TelemetryEventMap<K, V>[E]
  }
}[keyof TelemetryEventMap<K, V>]

/**
 * Handler function for telemetry events
 */
export type TelemetryHandler<K, V, E extends keyof TelemetryEventMap<K, V>> = (
  data: TelemetryEventMap<K, V>[E]
) => void

/**
 * Telemetry emitter interface exposed on batchers
 */
export interface BatcherTelemetry<K = unknown, V = unknown> {
  /**
   * Subscribe to a specific event type
   * @returns Unsubscribe function
   */
  on<E extends keyof TelemetryEventMap<K, V>>(
    event: E,
    handler: TelemetryHandler<K, V, E>
  ): () => void

  /**
   * Subscribe to all events
   * @returns Unsubscribe function
   */
  onAll(handler: (event: TelemetryEvent<K, V>) => void): () => void

  /**
   * Get all recorded events (for replay)
   */
  getEvents(): TelemetryEvent<K, V>[]

  /**
   * Clear event history
   */
  clear(): void

  /**
   * Check if telemetry is enabled
   */
  readonly enabled: boolean
}

/**
 * Internal telemetry emitter implementation
 */
export class TelemetryEmitter<K = unknown, V = unknown>
  implements BatcherTelemetry<K, V> {
  private handlers = new Map<
    keyof TelemetryEventMap<K, V>,
    Set<TelemetryHandler<K, V, keyof TelemetryEventMap<K, V>>>
  >()
  private allHandlers = new Set<(event: TelemetryEvent<K, V>) => void>()
  private events: TelemetryEvent<K, V>[] = []
  private _enabled: boolean
  private batcherId: string
  private batchCounter = 0

  constructor(batcherId: string, enabled: boolean = false) {
    this.batcherId = batcherId
    this._enabled = enabled
  }

  get enabled(): boolean {
    return this._enabled
  }

  /**
   * Generate a unique batch ID
   */
  nextBatchId(): string {
    return `${this.batcherId}:batch-${++this.batchCounter}`
  }

  /**
   * Emit an event
   */
  emit<E extends keyof TelemetryEventMap<K, V>>(
    eventType: E,
    data: Omit<TelemetryEventMap<K, V>[E], 'timestamp' | 'batcherId'>
  ): void {
    if (!this._enabled) return

    const fullData = {
      ...data,
      timestamp: performance.now(),
      batcherId: this.batcherId,
    } as TelemetryEventMap<K, V>[E]

    const event: TelemetryEvent<K, V> = {
      type: eventType,
      data: fullData,
    } as TelemetryEvent<K, V>

    // Store event
    this.events.push(event)

    // Notify specific handlers
    const handlers = this.handlers.get(eventType)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(fullData)
        } catch {
          // Ignore handler errors
        }
      }
    }

    // Notify all handlers
    for (const handler of this.allHandlers) {
      try {
        handler(event)
      } catch {
        // Ignore handler errors
      }
    }
  }

  on<E extends keyof TelemetryEventMap<K, V>>(
    event: E,
    handler: TelemetryHandler<K, V, E>
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    const handlers = this.handlers.get(event)!
    handlers.add(handler as TelemetryHandler<K, V, keyof TelemetryEventMap<K, V>>)

    return () => {
      handlers.delete(handler as TelemetryHandler<K, V, keyof TelemetryEventMap<K, V>>)
    }
  }

  onAll(handler: (event: TelemetryEvent<K, V>) => void): () => void {
    this.allHandlers.add(handler)
    return () => {
      this.allHandlers.delete(handler)
    }
  }

  getEvents(): TelemetryEvent<K, V>[] {
    return [...this.events]
  }

  clear(): void {
    this.events = []
  }
}

/**
 * No-op telemetry for when telemetry is disabled
 */
export class NoopTelemetry<K = unknown, V = unknown>
  implements BatcherTelemetry<K, V> {
  readonly enabled = false

  on(): () => void {
    return () => { }
  }

  onAll(): () => void {
    return () => { }
  }

  getEvents(): TelemetryEvent<K, V>[] {
    return []
  }

  clear(): void { }
}

