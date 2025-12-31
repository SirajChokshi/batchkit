<script lang="ts">
  import type { TimelineEvent, BatchGroup } from '../lib/useBatcherTelemetry.svelte'
  import type { TelemetryEventMap } from 'batchkit'

  interface Props {
    events: TimelineEvent[]
    batches: Map<string, BatchGroup>
  }

  let { events, batches }: Props = $props()

  // Build batch rows with their load events
  interface BatchRow {
    batchId: string
    loads: Array<{ id: string; key: unknown; time: number; deduped: boolean; visualOffset?: number }>
    dispatchTime: number
    resolveTime: number | null
    duration: number | null
    status: 'dispatching' | 'resolved' | 'error'
    keyCount: number
  }

  // Time window for the visualization
  const timeWindow = $derived(() => {
    if (events.length === 0) return { start: 0, end: 1000, scale: 1 }
    
    const times = events.map(e => e.relativeTime)
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const padding = Math.max(100, (maxTime - minTime) * 0.1)
    
    const start = Math.max(0, minTime - 20)
    const end = maxTime + padding
    const range = end - start
    
    return { start, end, scale: 100 / range }
  })

  // Build rows from events
  const batchRows = $derived(() => {
    const rows: BatchRow[] = []
    let currentLoads: Array<{ id: string; key: unknown; time: number; deduped: boolean }> = []
    
    for (const event of events) {
      if (event.type === 'load:called') {
        const data = event.data as TelemetryEventMap['load:called']
        currentLoads.push({
          id: event.id,
          key: data.key,
          time: event.relativeTime,
          deduped: false,
        })
      } else if (event.type === 'load:deduped') {
        const data = event.data as TelemetryEventMap['load:deduped']
        currentLoads.push({
          id: event.id,
          key: data.key,
          time: event.relativeTime,
          deduped: true,
        })
      } else if (event.type === 'batch:dispatching') {
        const data = event.data as TelemetryEventMap['batch:dispatching']
        const batch = batches.get(data.batchId)
        
        // Add visual offset for stacked dots
        const loadWithOffsets = currentLoads.map((load, i) => ({
          ...load,
          visualOffset: i * 3, // Small pixel offset for stacking
        }))
        
        rows.push({
          batchId: data.batchId,
          loads: loadWithOffsets,
          dispatchTime: event.relativeTime,
          resolveTime: batch?.endTime ?? null,
          duration: batch?.duration ?? null,
          status: batch?.status === 'error' ? 'error' : batch?.status === 'resolved' ? 'resolved' : 'dispatching',
          keyCount: data.keys.length,
        })
        
        currentLoads = []
      }
    }
    
    // If there are pending loads
    if (currentLoads.length > 0) {
      const loadWithOffsets = currentLoads.map((load, i) => ({
        ...load,
        visualOffset: i * 3,
      }))
      rows.push({
        batchId: 'pending',
        loads: loadWithOffsets,
        dispatchTime: currentLoads[currentLoads.length - 1]?.time ?? 0,
        resolveTime: null,
        duration: null,
        status: 'dispatching',
        keyCount: currentLoads.filter(l => !l.deduped).length,
      })
    }
    
    return rows
  })

  function timeToPercent(time: number): number {
    const { start, end } = timeWindow()
    return ((time - start) / (end - start)) * 100
  }

  function formatTime(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
    return `${ms.toFixed(0)}ms`
  }

  function formatKey(key: unknown): string {
    if (typeof key === 'string') return key
    return JSON.stringify(key)
  }

  // Time markers for the axis - aim for ~5 markers
  const timeMarkers = $derived(() => {
    const { start, end } = timeWindow()
    const range = end - start
    
    // Calculate step to get roughly 5 markers
    const rawStep = range / 5
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const normalized = rawStep / magnitude
    
    let step: number
    if (normalized <= 1) step = magnitude
    else if (normalized <= 2) step = 2 * magnitude
    else if (normalized <= 5) step = 5 * magnitude
    else step = 10 * magnitude
    
    const markers: number[] = []
    let t = Math.ceil(start / step) * step
    while (t <= end && markers.length < 8) {
      markers.push(t)
      t += step
    }
    
    return markers
  })
</script>

<div class="timeline-container">
  <div class="timeline-header">
    <h3>Timeline</h3>
    {#if events.length > 0}
      <span class="event-count">{events.length} events</span>
    {/if}
  </div>
  
  {#if batchRows().length === 0}
    <div class="empty-state">
      <div class="empty-icon">◉</div>
      <p>Click buttons to trigger load() calls</p>
      <p class="hint">Watch requests batch together in real-time</p>
    </div>
  {:else}
    <div class="timeline-scroll">
      <!-- Time axis -->
      <div class="time-axis">
        {#each timeMarkers() as marker}
          <div class="time-marker" style="left: {timeToPercent(marker)}%">
            <div class="marker-line"></div>
            <span class="marker-label">{formatTime(marker)}</span>
          </div>
        {/each}
      </div>

      <!-- Batch rows -->
      <div class="batch-rows">
        {#each batchRows() as row, index (row.batchId)}
          <div class="batch-row">
            <!-- Row label -->
            <div class="row-label">
              <span class="batch-id">
                {#if row.batchId === 'pending'}
                  Pending
                {:else}
                  #{row.batchId.split('-').pop()}
                {/if}
              </span>
            </div>

            <!-- Row timeline -->
            <div class="row-track">
              <!-- Load event dots -->
              {#each row.loads as load, i (load.id)}
                <div 
                  class="load-dot"
                  class:deduped={load.deduped}
                  style="left: calc({timeToPercent(load.time)}% + {load.visualOffset ?? 0}px)"
                  title="{formatKey(load.key)}{load.deduped ? ' (deduped)' : ''}"
                >
                  <div class="dot"></div>
                </div>
              {/each}

              <!-- Batch span -->
              {#if row.status !== 'dispatching' || row.batchId === 'pending'}
                <div 
                  class="batch-span"
                  class:resolved={row.status === 'resolved'}
                  class:error={row.status === 'error'}
                  class:pending={row.batchId === 'pending'}
                  style="
                    left: {timeToPercent(row.loads[0]?.time ?? row.dispatchTime)}%;
                    width: {row.resolveTime 
                      ? timeToPercent(row.resolveTime) - timeToPercent(row.loads[0]?.time ?? row.dispatchTime)
                      : Math.max(5, timeToPercent(row.dispatchTime + 50) - timeToPercent(row.loads[0]?.time ?? row.dispatchTime))}%;
                  "
                >
                  <div class="span-line"></div>
                  <div class="span-end">
                    {#if row.status === 'resolved'}
                      <span class="status-icon">✓</span>
                    {:else if row.status === 'error'}
                      <span class="status-icon error">✗</span>
                    {:else}
                      <span class="status-icon pending">⋯</span>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Batch info tooltip -->
              <div 
                class="batch-info"
                style="left: {timeToPercent(row.resolveTime ?? row.dispatchTime)}%"
              >
                <span class="info-keys">{row.keyCount} key{row.keyCount !== 1 ? 's' : ''}</span>
                {#if row.duration}
                  <span class="info-duration">{row.duration.toFixed(0)}ms</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .timeline-container {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    display: flex;
    flex-direction: column;
    min-height: 200px;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  h3 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin: 0;
  }

  .event-count {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 1.5rem;
    color: var(--accent-primary);
    opacity: 0.5;
    margin-bottom: 0.75rem;
  }

  .empty-state p {
    margin: 0.2rem 0;
    font-size: 0.85rem;
  }

  .hint {
    color: var(--accent-primary);
    font-size: 0.8rem !important;
  }

  .timeline-scroll {
    padding: 1rem;
    overflow-x: auto;
  }

  .time-axis {
    position: relative;
    height: 24px;
    margin-left: 60px;
    border-bottom: 1px solid var(--border-color);
  }

  .time-marker {
    position: absolute;
    transform: translateX(-50%);
  }

  .marker-line {
    width: 1px;
    height: 8px;
    background: var(--border-color);
  }

  .marker-label {
    display: block;
    font-size: 0.65rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    white-space: nowrap;
    transform: translateX(-50%);
    margin-left: 50%;
    margin-top: 2px;
  }

  .batch-rows {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }

  .batch-row {
    display: flex;
    align-items: center;
    height: 36px;
  }

  .row-label {
    width: 60px;
    flex-shrink: 0;
    padding-right: 0.5rem;
    text-align: right;
  }

  .batch-id {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .row-track {
    flex: 1;
    position: relative;
    height: 100%;
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .load-dot {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent-primary);
    box-shadow: 0 0 6px var(--accent-primary);
    animation: popIn 0.15s ease;
  }

  @keyframes popIn {
    from { transform: scale(0); }
    to { transform: scale(1); }
  }

  .load-dot.deduped .dot {
    width: 7px;
    height: 7px;
    background: var(--accent-warning);
    box-shadow: 0 0 4px var(--accent-warning);
    opacity: 0.7;
  }

  .batch-span {
    position: absolute;
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
  }

  .span-line {
    flex: 1;
    height: 2px;
    background: var(--accent-secondary);
    opacity: 0.6;
  }

  .batch-span.resolved .span-line {
    background: var(--accent-success);
  }

  .batch-span.error .span-line {
    background: var(--accent-error);
  }

  .batch-span.pending .span-line {
    background: var(--text-muted);
    opacity: 0.4;
  }

  .span-end {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--bg-card);
    border: 2px solid var(--accent-success);
    margin-left: -1px;
  }

  .batch-span.error .span-end {
    border-color: var(--accent-error);
  }

  .batch-span.pending .span-end {
    border-color: var(--text-muted);
    border-style: dashed;
  }

  .status-icon {
    font-size: 0.65rem;
    color: var(--accent-success);
  }

  .status-icon.error {
    color: var(--accent-error);
  }

  .status-icon.pending {
    color: var(--text-muted);
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .batch-info {
    position: absolute;
    top: 50%;
    transform: translate(8px, -50%);
    display: flex;
    gap: 0.5rem;
    font-size: 0.65rem;
    white-space: nowrap;
  }

  .info-keys {
    color: var(--text-muted);
  }

  .info-duration {
    color: var(--accent-primary);
    font-family: var(--font-mono);
  }
</style>
