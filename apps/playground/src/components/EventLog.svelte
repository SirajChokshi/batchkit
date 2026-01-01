<script lang="ts">
import type { TraceEvent } from 'batchkit';
import type { TimelineEvent } from '../lib/useBatcherTelemetry.svelte';

interface Props {
  events: TimelineEvent[];
  hoveredBatchId?: string | null;
}

const { events, hoveredBatchId }: Props = $props();

// Build a map of event IDs to their batch IDs (for get events that happen before dispatch)
const eventToBatchMap = $derived.by(() => {
  const map = new Map<string, string>();
  let currentEventIds: string[] = [];
  
  for (const event of events) {
    const data = event.data as TraceEvent;
    
    if (data.type === 'get' || data.type === 'dedup') {
      currentEventIds.push(event.id);
    } else if (data.type === 'dispatch') {
      // Assign all pending get events to this batch
      for (const id of currentEventIds) {
        map.set(id, data.batchId);
      }
      currentEventIds = [];
      map.set(event.id, data.batchId);
    } else if (data.type === 'schedule' || data.type === 'resolve' || data.type === 'error' || data.type === 'abort') {
      map.set(event.id, data.batchId);
    }
  }
  
  // Assign remaining events to 'pending' batch
  for (const id of currentEventIds) {
    map.set(id, 'pending');
  }
  
  return map;
});

function isHighlighted(event: TimelineEvent): boolean {
  if (!hoveredBatchId) return false;
  return eventToBatchMap.get(event.id) === hoveredBatchId;
}

// Show most recent events first, limited to last 100
const displayEvents = $derived([...events].reverse().slice(0, 100));

function getEventIcon(type: string): string {
  switch (type) {
    case 'get':
      return '→';
    case 'dedup':
      return '⊕';
    case 'schedule':
      return '◎';
    case 'dispatch':
      return '▶';
    case 'resolve':
      return '✓';
    case 'error':
      return '✗';
    case 'abort':
      return '⊘';
    default:
      return '•';
  }
}

function getRowStyle(type: string): string {
  if (type === 'get') return 'text-stone-300';
  if (type === 'dedup') return 'text-stone-500';
  if (type === 'dispatch') return 'text-stone-400';
  if (type === 'resolve') return 'text-stone-400';
  if (type === 'schedule') return 'text-stone-500';
  if (type === 'error') return 'text-stone-300';
  return 'text-stone-600';
}

function formatEventData(event: TimelineEvent): string {
  const data = event.data as TraceEvent;
  switch (data.type) {
    case 'get':
    case 'dedup':
      return `"${data.key}"`;
    case 'schedule':
      return `#${data.batchId.split('-').pop()} size=${data.size}`;
    case 'dispatch':
      return `#${data.batchId.split('-').pop()} keys=${data.keys.length}`;
    case 'resolve':
      return `#${data.batchId.split('-').pop()} ${data.duration.toFixed(0)}ms`;
    case 'error':
      return `#${data.batchId.split('-').pop()} ${data.error.message}`;
    case 'abort':
      return `#${data.batchId.split('-').pop()}`;
    default:
      return '';
  }
}
</script>

<div class="bg-stone-900 flex flex-col flex-1 min-h-0">
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-stone-700 shrink-0">
    <h3 class="text-xs uppercase tracking-wider text-stone-500 font-mono font-medium">Event Log</h3>
    {#if events.length > 0}
      <span class="text-xs text-stone-600 font-mono">{events.length} total</span>
    {/if}
  </div>
  
  <div class="flex-1 overflow-y-auto min-h-0 h-full flex flex-col">
    {#if events.length === 0}
      <div class="flex-1 flex items-center justify-center">
        <p class="text-sm text-stone-600 font-mono">No events recorded</p>
      </div>
    {:else}
      <!-- Table header -->
      <div class="grid grid-cols-[70px_24px_72px_1fr] text-xs font-mono text-stone-600 uppercase tracking-wider border-b border-stone-800 shrink-0">
        <div class="px-3 py-1.5">Time</div>
        <div class="py-1.5"></div>
        <div class="px-2 py-1.5">Type</div>
        <div class="px-2 py-1.5">Data</div>
      </div>

      <!-- Scrollable log entries -->
      <div class="eventlog-scroll flex-1 overflow-y-auto">
        {#each displayEvents as event (event.id)}
          {@const rowStyle = getRowStyle(event.type)}
          {@const highlighted = isHighlighted(event)}
          <div class="grid grid-cols-[70px_24px_72px_1fr] border-b border-stone-800/50 transition-colors
            {highlighted ? 'bg-stone-700/60 border-stone-600' : 'hover:bg-stone-800/30'}
            {rowStyle}">
            <div class="px-3 py-1 text-sm font-mono tabular-nums text-stone-600">
              {event.relativeTime.toFixed(0)}ms
            </div>
            <div class="py-1 text-sm font-mono text-center">
              {getEventIcon(event.type)}
            </div>
            <div class="px-2 py-1 text-sm font-mono">
              {event.type}
            </div>
            <div class="px-2 py-1 text-sm font-mono text-stone-500 truncate">
              {formatEventData(event)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Custom scrollbar matching Timeline */
  .eventlog-scroll {
    scrollbar-width: thin;
    scrollbar-color: #44403c #1c1917;
  }
  
  .eventlog-scroll::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  .eventlog-scroll::-webkit-scrollbar-track {
    background: #1c1917;
  }
  
  .eventlog-scroll::-webkit-scrollbar-thumb {
    background: #44403c;
    border: 2px solid #1c1917;
  }
  
  .eventlog-scroll::-webkit-scrollbar-thumb:hover {
    background: #57534e;
  }
  
  .eventlog-scroll::-webkit-scrollbar-corner {
    background: #1c1917;
  }
</style>
