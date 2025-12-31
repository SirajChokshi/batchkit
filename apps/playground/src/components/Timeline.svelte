<script lang="ts">
  import type { TimelineEvent, BatchGroup } from '../lib/useBatcherTelemetry.svelte'
  import type { TraceEvent } from 'batchkit'

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
    status: 'dispatching' | 'resolved' | 'error' | 'aborted'
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
      const data = event.data as TraceEvent
      
      if (data.type === 'get') {
        currentLoads.push({
          id: event.id,
          key: data.key,
          time: event.relativeTime,
          deduped: false,
        })
      } else if (data.type === 'dedup') {
        currentLoads.push({
          id: event.id,
          key: data.key,
          time: event.relativeTime,
          deduped: true,
        })
      } else if (data.type === 'dispatch') {
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
          status: batch?.status === 'error' ? 'error' : 
                  batch?.status === 'aborted' ? 'aborted' :
                  batch?.status === 'resolved' ? 'resolved' : 'dispatching',
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

<div class="bg-stone-900 flex flex-col min-h-[200px] border-b border-stone-700">
  <div class="flex justify-between items-center px-4 py-3 border-b border-stone-700">
    <h3 class="text-xs uppercase tracking-wide text-stone-400 font-mono">Timeline</h3>
    {#if events.length > 0}
      <span class="text-[0.7rem] text-stone-500 font-mono">{events.length} events</span>
    {/if}
  </div>
  
  {#if batchRows().length === 0}
    <div class="flex flex-col items-center justify-center py-12 px-4 text-center text-stone-500">
      <div class="text-2xl text-stone-600 mb-3">◉</div>
      <p class="text-sm font-mono">Click buttons to trigger get() calls</p>
      <p class="text-xs text-stone-600 font-mono mt-1">Watch requests batch together in real-time</p>
    </div>
  {:else}
    <div class="p-4 overflow-x-auto">
      <!-- Time axis -->
      <div class="relative h-6 ml-[60px] border-b border-stone-700">
        {#each timeMarkers() as marker}
          <div class="absolute -translate-x-1/2" style="left: {timeToPercent(marker)}%">
            <div class="w-px h-2 bg-stone-700"></div>
            <span class="block text-[0.65rem] text-stone-500 font-mono whitespace-nowrap -translate-x-1/2 ml-[50%] mt-0.5">{formatTime(marker)}</span>
          </div>
        {/each}
      </div>

      <!-- Batch rows -->
      <div class="flex flex-col gap-1 mt-2">
        {#each batchRows() as row, index (row.batchId)}
          <div class="flex items-center h-9">
            <!-- Row label -->
            <div class="w-[60px] shrink-0 pr-2 text-right">
              <span class="text-[0.7rem] font-mono text-stone-500">
                {#if row.batchId === 'pending'}
                  Pending
                {:else}
                  #{row.batchId.split('-').pop()}
                {/if}
              </span>
            </div>

            <!-- Row timeline -->
            <div class="flex-1 relative h-full bg-stone-800">
              <!-- Load event dots -->
              {#each row.loads as load, i (load.id)}
                <div 
                  class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2]"
                  style="left: calc({timeToPercent(load.time)}% + {load.visualOffset ?? 0}px)"
                  title="{formatKey(load.key)}{load.deduped ? ' (deduped)' : ''}"
                >
                  <div class="w-2 h-2 bg-stone-100 {load.deduped ? 'opacity-40 w-1.5 h-1.5' : ''}"></div>
                </div>
              {/each}

              <!-- Batch span -->
              {#if row.status !== 'dispatching' || row.batchId === 'pending'}
                <div 
                  class="absolute top-1/2 h-0.5 -translate-y-1/2 flex items-center"
                  style="
                    left: {timeToPercent(row.loads[0]?.time ?? row.dispatchTime)}%;
                    width: {row.resolveTime 
                      ? timeToPercent(row.resolveTime) - timeToPercent(row.loads[0]?.time ?? row.dispatchTime)
                      : Math.max(5, timeToPercent(row.dispatchTime + 50) - timeToPercent(row.loads[0]?.time ?? row.dispatchTime))}%;
                  "
                >
                  <div class="flex-1 h-0.5 {row.status === 'resolved' ? 'bg-stone-400' : row.status === 'error' ? 'bg-stone-500' : 'bg-stone-600'} {row.batchId === 'pending' ? 'opacity-40' : 'opacity-60'}"></div>
                  <div class="flex items-center justify-center w-4 h-4 bg-stone-900 border border-stone-500 -ml-px {row.batchId === 'pending' ? 'border-dashed' : ''}">
                    {#if row.status === 'resolved'}
                      <span class="text-[0.6rem] text-stone-400">✓</span>
                    {:else if row.status === 'error'}
                      <span class="text-[0.6rem] text-stone-500">✗</span>
                    {:else if row.status === 'aborted'}
                      <span class="text-[0.6rem] text-stone-600">⊘</span>
                    {:else}
                      <span class="text-[0.6rem] text-stone-600">⋯</span>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Batch info tooltip -->
              <div 
                class="absolute top-1/2 translate-x-2 -translate-y-1/2 flex gap-2 text-[0.65rem] whitespace-nowrap font-mono"
                style="left: {timeToPercent(row.resolveTime ?? row.dispatchTime)}%"
              >
                <span class="text-stone-500">{row.keyCount} key{row.keyCount !== 1 ? 's' : ''}</span>
                {#if row.duration}
                  <span class="text-stone-400">{row.duration.toFixed(0)}ms</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
