/**
 * Svelte 5 bridge for batchkit telemetry
 * Connects the batcher's telemetry events to reactive Svelte state
 */

import type { Batcher, TelemetryEvent, TelemetryEventMap } from 'batchkit'

export interface TimelineEvent {
  id: string
  type: TelemetryEvent['type']
  timestamp: number
  data: TelemetryEvent['data']
  // Computed for visualization
  relativeTime: number
}

export interface BatchGroup {
  batchId: string
  keys: unknown[]
  status: 'pending' | 'dispatching' | 'resolved' | 'error'
  startTime: number
  endTime?: number
  duration?: number
  results?: unknown[]
  error?: Error
}

export interface TelemetryState {
  events: TimelineEvent[]
  batches: Map<string, BatchGroup>
  stats: {
    totalLoads: number
    totalBatches: number
    cacheHits: number
    dedupedKeys: number
    avgBatchSize: number
    avgDuration: number
  }
}

/**
 * Create reactive telemetry state from a batcher
 */
export function createTelemetryState() {
  let events = $state<TimelineEvent[]>([])
  let batches = $state<Map<string, BatchGroup>>(new Map())
  let startTime = $state<number>(0)

  // Computed stats
  const stats = $derived({
    totalLoads: events.filter(e => e.type === 'load:called').length,
    totalBatches: events.filter(e => e.type === 'batch:resolved').length,
    cacheHits: events.filter(e => e.type === 'load:cached').length,
    dedupedKeys: events.filter(e => e.type === 'load:deduped').length,
    avgBatchSize: (() => {
      const resolved = events.filter(e => e.type === 'batch:resolved')
      if (resolved.length === 0) return 0
      const total = resolved.reduce((sum, e) => {
        const data = e.data as TelemetryEventMap['batch:resolved']
        return sum + data.keys.length
      }, 0)
      return total / resolved.length
    })(),
    avgDuration: (() => {
      const resolved = events.filter(e => e.type === 'batch:resolved')
      if (resolved.length === 0) return 0
      const total = resolved.reduce((sum, e) => {
        const data = e.data as TelemetryEventMap['batch:resolved']
        return sum + data.duration
      }, 0)
      return total / resolved.length
    })(),
  })

  let unsubscribe: (() => void) | null = null
  let eventCounter = 0

  function subscribe<K, V>(batcher: Batcher<K, V>) {
    // Unsubscribe from previous batcher if any
    if (unsubscribe) {
      unsubscribe()
    }

    // Reset state
    events = []
    batches = new Map()
    startTime = performance.now()
    eventCounter = 0

    // Subscribe to all telemetry events
    unsubscribe = batcher._telemetry.onAll((event) => {
      const timelineEvent: TimelineEvent = {
        id: `event-${++eventCounter}`,
        type: event.type,
        timestamp: event.data.timestamp,
        data: event.data,
        relativeTime: event.data.timestamp - startTime,
      }

      events = [...events, timelineEvent]

      // Track batch lifecycle
      if (event.type === 'batch:dispatching') {
        const data = event.data as TelemetryEventMap['batch:dispatching']
        const newBatches = new Map(batches)
        newBatches.set(data.batchId, {
          batchId: data.batchId,
          keys: data.keys,
          status: 'dispatching',
          startTime: data.timestamp - startTime,
        })
        batches = newBatches
      }

      if (event.type === 'batch:resolved') {
        const data = event.data as TelemetryEventMap['batch:resolved']
        const existing = batches.get(data.batchId)
        if (existing) {
          const newBatches = new Map(batches)
          newBatches.set(data.batchId, {
            ...existing,
            status: 'resolved',
            endTime: data.timestamp - startTime,
            duration: data.duration,
            results: data.results as unknown[],
          })
          batches = newBatches
        }
      }

      if (event.type === 'batch:error') {
        const data = event.data as TelemetryEventMap['batch:error']
        const existing = batches.get(data.batchId)
        if (existing) {
          const newBatches = new Map(batches)
          newBatches.set(data.batchId, {
            ...existing,
            status: 'error',
            endTime: data.timestamp - startTime,
            error: data.error,
          })
          batches = newBatches
        }
      }
    })
  }

  function clear() {
    events = []
    batches = new Map()
    startTime = performance.now()
    eventCounter = 0
  }

  function cleanup() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  return {
    get events() { return events },
    get batches() { return batches },
    get stats() { return stats },
    get startTime() { return startTime },
    subscribe,
    clear,
    cleanup,
  }
}

