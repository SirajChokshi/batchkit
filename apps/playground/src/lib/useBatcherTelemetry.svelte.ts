/**
 * Svelte 5 bridge for batchkit tracing
 * Connects the batcher's trace events to reactive Svelte state
 */

import type { TraceEvent, TraceHandler } from 'batchkit';

export interface TimelineEvent {
  id: string;
  type: TraceEvent['type'];
  timestamp: number;
  data: TraceEvent;
  // Computed for visualization
  relativeTime: number;
}

export interface BatchGroup {
  batchId: string;
  keys: unknown[];
  status: 'pending' | 'dispatching' | 'resolved' | 'error' | 'aborted';
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: Error;
}

export interface TelemetryState {
  events: TimelineEvent[];
  batches: Map<string, BatchGroup>;
  stats: {
    totalLoads: number;
    totalBatches: number;
    dedupedKeys: number;
    avgBatchSize: number;
    avgDuration: number;
  };
}

/**
 * Create reactive telemetry state that can be used with batchers
 */
export function createTelemetryState() {
  let events = $state<TimelineEvent[]>([]);
  let batches = $state<Map<string, BatchGroup>>(new Map());
  let startTime = $state<number>(performance.now());

  // Computed stats
  const stats = $derived({
    totalLoads: events.filter((e) => e.type === 'get').length,
    totalBatches: events.filter((e) => e.type === 'resolve').length,
    dedupedKeys: events.filter((e) => e.type === 'dedup').length,
    avgBatchSize: (() => {
      const dispatches = events.filter((e) => e.type === 'dispatch');
      if (dispatches.length === 0) return 0;
      const total = dispatches.reduce((sum, e) => {
        const data = e.data as Extract<TraceEvent, { type: 'dispatch' }>;
        return sum + data.keys.length;
      }, 0);
      return total / dispatches.length;
    })(),
    avgDuration: (() => {
      const resolved = events.filter((e) => e.type === 'resolve');
      if (resolved.length === 0) return 0;
      const total = resolved.reduce((sum, e) => {
        const data = e.data as Extract<TraceEvent, { type: 'resolve' }>;
        return sum + data.duration;
      }, 0);
      return total / resolved.length;
    })(),
  });

  let eventCounter = 0;

  /**
   * Returns a trace handler that updates this state.
   * Pass this to batch() as the trace option.
   *
   * Uses requestAnimationFrame to batch multiple trace events
   * into a single UI update, preventing lag during bursts.
   */
  function createTraceHandler(): TraceHandler {
    let pending: TraceEvent[] = [];
    let scheduled = false;

    return (event: TraceEvent) => {
      pending.push(event);

      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          // Grab all pending events
          const batch = pending;
          pending = [];
          scheduled = false;

          // Convert to timeline events
          const newTimelineEvents: TimelineEvent[] = batch.map((e) => ({
            id: `event-${++eventCounter}`,
            type: e.type,
            timestamp: e.timestamp,
            data: e,
            relativeTime: e.timestamp - startTime,
          }));

          // Single state update for all events
          events = [...events, ...newTimelineEvents];

          // Process batch updates
          let batchesChanged = false;
          let newBatches = batches;

          for (const event of batch) {
            if (event.type === 'dispatch') {
              if (!batchesChanged) {
                newBatches = new Map(batches);
                batchesChanged = true;
              }
              newBatches.set(event.batchId, {
                batchId: event.batchId,
                keys: event.keys,
                status: 'dispatching',
                startTime: event.timestamp - startTime,
              });
            }

            if (event.type === 'resolve') {
              const existing = (batchesChanged ? newBatches : batches).get(
                event.batchId,
              );
              if (existing) {
                if (!batchesChanged) {
                  newBatches = new Map(batches);
                  batchesChanged = true;
                }
                newBatches.set(event.batchId, {
                  ...existing,
                  status: 'resolved',
                  endTime: event.timestamp - startTime,
                  duration: event.duration,
                });
              }
            }

            if (event.type === 'error') {
              const existing = (batchesChanged ? newBatches : batches).get(
                event.batchId,
              );
              if (existing) {
                if (!batchesChanged) {
                  newBatches = new Map(batches);
                  batchesChanged = true;
                }
                newBatches.set(event.batchId, {
                  ...existing,
                  status: 'error',
                  endTime: event.timestamp - startTime,
                  error: event.error,
                });
              }
            }

            if (event.type === 'abort') {
              const existing = (batchesChanged ? newBatches : batches).get(
                event.batchId,
              );
              if (existing) {
                if (!batchesChanged) {
                  newBatches = new Map(batches);
                  batchesChanged = true;
                }
                newBatches.set(event.batchId, {
                  ...existing,
                  status: 'aborted',
                  endTime: event.timestamp - startTime,
                });
              }
            }
          }

          if (batchesChanged) {
            batches = newBatches;
          }
        });
      }
    };
  }

  function clear() {
    events = [];
    batches = new Map();
    startTime = performance.now();
    eventCounter = 0;
  }

  return {
    get events() {
      return events;
    },
    get batches() {
      return batches;
    },
    get stats() {
      return stats;
    },
    get startTime() {
      return startTime;
    },
    createTraceHandler,
    clear,
  };
}
