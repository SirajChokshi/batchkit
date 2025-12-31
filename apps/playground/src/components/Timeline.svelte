<script lang="ts">
import type { TraceEvent } from 'batchkit';
import type {
  BatchGroup,
  TimelineEvent,
} from '../lib/useBatcherTelemetry.svelte';

  interface Props {
  events: TimelineEvent[];
  batches: Map<string, BatchGroup>;
  }

const { events, batches }: Props = $props();

// Selected row for highlighting
let selectedBatchId: string | null = $state(null);
let hoveredBatchId: string | null = $state(null);

  // Build batch rows with their load events
  interface BatchRow {
  batchId: string;
  loads: Array<{ id: string; key: unknown; time: number; deduped: boolean }>;
  scheduleTime: number;
  dispatchTime: number;
  resolveTime: number | null;
  duration: number | null;
  status: 'pending' | 'dispatching' | 'resolved' | 'error' | 'aborted';
  keyCount: number;
  keys: unknown[];
  }

  // Time window for the visualization
const timeWindow = $derived.by(() => {
  if (events.length === 0) return { start: 0, end: 1000 };
    
  const times = events.map((e) => e.relativeTime);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const padding = Math.max(50, (maxTime - minTime) * 0.05);

  return {
    start: Math.max(0, minTime - 10),
    end: maxTime + padding,
  };
});

  // Build rows from events
const batchRows = $derived.by(() => {
  const rows: BatchRow[] = [];
  let currentLoads: Array<{
    id: string;
    key: unknown;
    time: number;
    deduped: boolean;
  }> = [];
  let currentScheduleTime = 0;
    
    for (const event of events) {
    const data = event.data as TraceEvent;
      
      if (data.type === 'get') {
        currentLoads.push({
          id: event.id,
          key: data.key,
          time: event.relativeTime,
          deduped: false,
      });
      } else if (data.type === 'dedup') {
        currentLoads.push({
          id: event.id,
          key: data.key,
          time: event.relativeTime,
          deduped: true,
      });
    } else if (data.type === 'schedule') {
      currentScheduleTime = event.relativeTime;
      } else if (data.type === 'dispatch') {
      const batch = batches.get(data.batchId);
        
        rows.push({
          batchId: data.batchId,
        loads: [...currentLoads],
        scheduleTime:
          currentScheduleTime || currentLoads[0]?.time || event.relativeTime,
          dispatchTime: event.relativeTime,
          resolveTime: batch?.endTime ?? null,
          duration: batch?.duration ?? null,
        status:
          batch?.status === 'error'
            ? 'error'
            : batch?.status === 'aborted'
              ? 'aborted'
              : batch?.status === 'resolved'
                ? 'resolved'
                : 'dispatching',
          keyCount: data.keys.length,
        keys: data.keys,
      });
        
      currentLoads = [];
      currentScheduleTime = 0;
      }
    }
    
  // Pending batch (not yet dispatched)
    if (currentLoads.length > 0) {
      rows.push({
        batchId: 'pending',
      loads: currentLoads,
      scheduleTime: currentLoads[0]?.time ?? 0,
        dispatchTime: currentLoads[currentLoads.length - 1]?.time ?? 0,
        resolveTime: null,
        duration: null,
      status: 'pending',
      keyCount: currentLoads.filter((l) => !l.deduped).length,
      keys: currentLoads.filter((l) => !l.deduped).map((l) => l.key),
    });
    }
    
  return rows;
});

  function timeToPercent(time: number): number {
  const { start, end } = timeWindow;
  return ((time - start) / (end - start)) * 100;
  }

  function formatTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${ms.toFixed(0)}ms`;
  return `${ms.toFixed(1)}ms`;
  }

  function formatKey(key: unknown): string {
  if (typeof key === 'string') return key;
  return JSON.stringify(key);
  }

function getStatusLabel(status: BatchRow['status']): string {
  switch (status) {
    case 'pending':
      return 'Queued';
    case 'dispatching':
      return 'Fetching';
    case 'resolved':
      return 'Complete';
    case 'error':
      return 'Error';
    case 'aborted':
      return 'Aborted';
  }
}

function getKeysTooltip(row: BatchRow): string {
  const keysList = row.keys.slice(0, 10).map(k => formatKey(k)).join(', ');
  const suffix = row.keys.length > 10 ? ` +${row.keys.length - 10} more` : '';
  return `Keys (${row.keyCount}): ${keysList}${suffix}`;
}

// Calculate waterfall bar dimensions for a row
function getWaterfallDimensions(row: BatchRow) {
  const startPct = timeToPercent(row.scheduleTime);
  const endPct = row.resolveTime
    ? timeToPercent(row.resolveTime)
    : timeToPercent(row.dispatchTime + (row.duration || 50));
  const dispatchPct = timeToPercent(row.dispatchTime);
  const width = Math.max(endPct - startPct, 0.5);
  const queueWidth = Math.max(dispatchPct - startPct, 0);

  return { startPct, width, queueWidth };
}

// Time ruler markers
const timeMarkers = $derived.by(() => {
  const { start, end } = timeWindow;
  const range = end - start;
  if (range <= 0) return [];
    
  // Calculate nice step sizes
  const targetMarkers = 6;
  const rawStep = range / targetMarkers;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
    
  let step: number;
  if (normalized <= 1) step = magnitude;
  else if (normalized <= 2) step = 2 * magnitude;
  else if (normalized <= 5) step = 5 * magnitude;
  else step = 10 * magnitude;
    
  const markers: number[] = [];
  let t = Math.ceil(start / step) * step;
  while (t <= end && markers.length < 10) {
    markers.push(t);
    t += step;
    }
    
  return markers;
});
</script>

<div class="timeline-container flex flex-col min-h-[280px] bg-stone-900">
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-stone-700 bg-stone-900 shrink-0">
    <div class="flex items-center gap-3">
      <h3 class="text-[11px] uppercase tracking-wider text-stone-500 font-mono font-medium">Timeline</h3>
      {#if batchRows.length > 0}
        <span class="text-[10px] text-stone-600 font-mono">
          {batchRows.length} batch{batchRows.length !== 1 ? 'es' : ''}
        </span>
      {/if}
    </div>
    {#if events.length > 0}
      <span class="text-[10px] text-stone-600 font-mono">{events.length} events</span>
    {/if}
  </div>
  
  {#if batchRows.length === 0}
    <!-- Empty state -->
    <div class="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center">
      <div class="w-8 h-8 border border-stone-700 flex items-center justify-center mb-3">
        <div class="w-2 h-2 bg-stone-700"></div>
      </div>
      <p class="text-[11px] font-mono text-stone-500 mb-1">No requests recorded</p>
      <p class="text-[10px] font-mono text-stone-600">Click controls to trigger get() calls</p>
    </div>
  {:else}
    <!-- Table header -->
    <div class="grid grid-cols-[80px_60px_80px_1fr] border-b border-stone-800 bg-stone-900 shrink-0 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
      <div class="px-3 py-2 border-r border-stone-800">Batch</div>
      <div class="px-3 py-2 border-r border-stone-800">Status</div>
      <div class="px-3 py-2 border-r border-stone-800">Time</div>
      <div class="px-3 py-2">Waterfall</div>
      </div>

    <!-- Table body with custom scrollbar -->
    <div class="timeline-scroll flex-1 overflow-y-auto overflow-x-hidden">
      {#each batchRows as row (row.batchId)}
        {@const isSelected = selectedBatchId === row.batchId}
        {@const isHovered = hoveredBatchId === row.batchId}
        {@const dims = getWaterfallDimensions(row)}
        <div 
          class="grid grid-cols-[80px_60px_80px_1fr] border-b border-stone-800 cursor-pointer group
            {isSelected ? 'bg-stone-800' : isHovered ? 'bg-stone-850' : 'bg-stone-900 hover:bg-stone-850'}"
          onclick={() => selectedBatchId = selectedBatchId === row.batchId ? null : row.batchId}
          onmouseenter={() => hoveredBatchId = row.batchId}
          onmouseleave={() => hoveredBatchId = null}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && (selectedBatchId = selectedBatchId === row.batchId ? null : row.batchId)}
        >
          <!-- Batch ID -->
          <div class="px-3 py-2 border-r border-stone-800 flex items-center" title={getKeysTooltip(row)}>
            <span class="text-[11px] font-mono text-stone-300">
                {#if row.batchId === 'pending'}
                <span class="text-stone-500">pending</span>
                {:else}
                  #{row.batchId.split('-').pop()}
                {/if}
              </span>
            <span class="text-[10px] text-stone-600 ml-1.5">{row.keyCount}k</span>
          </div>

          <!-- Status -->
          <div class="px-3 py-2 border-r border-stone-800 flex items-center">
            <span class="text-[10px] font-mono
              {row.status === 'resolved' ? 'text-stone-400' : ''}
              {row.status === 'dispatching' ? 'text-stone-500' : ''}
              {row.status === 'pending' ? 'text-stone-600' : ''}
              {row.status === 'error' ? 'text-stone-400' : ''}
              {row.status === 'aborted' ? 'text-stone-600' : ''}
            ">
              {getStatusLabel(row.status)}
            </span>
          </div>

          <!-- Duration -->
          <div class="px-3 py-2 border-r border-stone-800 flex items-center">
            <span class="text-[11px] font-mono tabular-nums {row.duration ? 'text-stone-300' : 'text-stone-600'}">
              {#if row.duration}
                {formatDuration(row.duration)}
              {:else if row.status === 'pending'}
                —
              {:else}
                ...
              {/if}
            </span>
            </div>

          <!-- Waterfall -->
          <div class="px-2 py-2 flex items-center min-w-0">
            <div class="relative w-full h-4">
              <!-- Time ruler grid lines (subtle) -->
              {#each timeMarkers as marker}
                <div 
                  class="absolute top-0 bottom-0 w-px bg-stone-800"
                  style="left: {timeToPercent(marker)}%"
                ></div>
              {/each}

              <!-- Waterfall bar -->
                <div 
                class="absolute top-1/2 -translate-y-1/2 h-3 flex"
                style="left: {dims.startPct}%; width: {dims.width}%;"
              >
                <!-- Queue phase (waiting to dispatch) -->
                {#if dims.queueWidth > 0}
                  <div 
                    class="h-full bg-stone-700 shrink-0"
                    style="width: {(dims.queueWidth / dims.width) * 100}%;"
                  ></div>
                {/if}
                
                <!-- Fetch phase -->
                <div 
                  class="h-full flex-1 min-w-[2px]
                    {row.status === 'resolved' ? 'bg-stone-500' : ''}
                    {row.status === 'dispatching' ? 'bg-stone-600 waterfall-pending' : ''}
                    {row.status === 'pending' ? 'bg-stone-700 waterfall-pending' : ''}
                    {row.status === 'error' ? 'bg-stone-500' : ''}
                    {row.status === 'aborted' ? 'bg-stone-700' : ''}
                  "
                ></div>
              </div>

              <!-- Time label on hover -->
              {#if isHovered || isSelected}
                <div 
                  class="absolute -top-0.5 text-[9px] font-mono text-stone-500 whitespace-nowrap"
                  style="left: {dims.startPct}%"
                >
                  {formatTime(row.scheduleTime)}
                </div>
              {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

    <!-- Time ruler footer -->
    <div class="relative h-5 border-t border-stone-700 bg-stone-900 shrink-0 ml-[220px] mr-2">
      {#each timeMarkers as marker}
        <div 
          class="absolute top-0 flex flex-col items-center -translate-x-1/2"
          style="left: {timeToPercent(marker)}%"
        >
          <div class="w-px h-1.5 bg-stone-700"></div>
          <span class="text-[9px] font-mono text-stone-600 mt-0.5">{formatTime(marker)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Custom scrollbar */
  .timeline-scroll {
    scrollbar-width: thin;
    scrollbar-color: #44403c #1c1917;
  }

  .timeline-scroll::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .timeline-scroll::-webkit-scrollbar-track {
    background: #1c1917;
  }

  .timeline-scroll::-webkit-scrollbar-thumb {
    background: #44403c;
    border: 2px solid #1c1917;
  }

  .timeline-scroll::-webkit-scrollbar-thumb:hover {
    background: #57534e;
  }

  .timeline-scroll::-webkit-scrollbar-corner {
    background: #1c1917;
  }

  /* Hover state for rows */
  .bg-stone-850 {
    background-color: #25231f;
  }

  /* Pending animation - subtle pulse */
  .waterfall-pending {
    animation: waterfall-pulse 1.5s ease-in-out infinite;
  }

  @keyframes waterfall-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
</style>
