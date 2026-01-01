<script lang="ts">
import type { TraceEvent } from 'batchkit';
import type {
  BatchGroup,
  TimelineEvent,
} from '../lib/useBatcherTelemetry.svelte';

interface Props {
  events: TimelineEvent[];
  batches: Map<string, BatchGroup>;
  onHoverBatch?: (batchId: string | null) => void;
}

const { events, batches, onHoverBatch }: Props = $props();

interface BatchInfo {
  batchId: string;
  keys: string[];
  status: 'pending' | 'dispatching' | 'resolved' | 'error';
  duration: number | null;
}

const batchList = $derived.by(() => {
  const list: BatchInfo[] = [];
  let pendingKeys: string[] = [];
  
  for (const event of events) {
    const data = event.data as TraceEvent;
    
    if (data.type === 'get') {
      pendingKeys.push(String(data.key));
    } else if (data.type === 'dispatch') {
      const batch = batches.get(data.batchId);
      list.push({
        batchId: data.batchId,
        keys: data.keys.map(k => String(k)),
        status: batch?.status === 'resolved' ? 'resolved' 
              : batch?.status === 'error' ? 'error' 
              : 'dispatching',
        duration: batch?.duration ?? null,
      });
      pendingKeys = [];
    }
  }
  
  // Pending keys not yet dispatched
  if (pendingKeys.length > 0) {
    list.push({
      batchId: 'pending',
      keys: pendingKeys,
      status: 'pending',
      duration: null,
    });
  }
  
  return list;
});

function formatMs(ms: number): string {
  return `${Math.round(ms)}ms`;
}
</script>

<div class="bg-stone-900 flex-1 flex flex-col">
  <div class="px-3 py-2 border-b border-stone-700">
    <h3 class="text-xs uppercase tracking-wider text-stone-500 font-mono">
      Batching Demo
    </h3>
  </div>
  
  {#if batchList.length === 0}
    <div class="px-3 py-6 text-center h-full flex items-center justify-center flex-col">
      <p class="text-sm font-mono text-stone-500 mb-1">Click controls to the left to simulate requests</p>
      <p class="text-xs font-mono text-stone-600">Watch how multiple .get() calls become one batch</p>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto">
      {#each batchList as batch, i (batch.batchId)}
        <div 
          role="button"
          tabindex="0"
          class="border-b border-stone-800 px-3 py-2 cursor-pointer hover:bg-stone-800/50 transition-colors"
          onmouseenter={() => onHoverBatch?.(batch.batchId)}
          onmouseleave={() => onHoverBatch?.(null)}
        >
          <!-- Batch header -->
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-mono text-stone-500">
              {batch.keys.length} request{batch.keys.length !== 1 ? 's' : ''}
            </span>
            <span class="text-stone-700">→</span>
            <span class="text-xs font-mono font-semibold
              {batch.status === 'resolved' ? 'text-stone-300' : ''}
              {batch.status === 'dispatching' ? 'text-stone-400' : ''}
              {batch.status === 'pending' ? 'text-stone-500' : ''}
              {batch.status === 'error' ? 'text-stone-400' : ''}
            ">
              1 batch
            </span>
            
            {#if batch.status === 'resolved' && batch.duration}
              <span class="text-stone-700">→</span>
              <span class="text-xs font-mono text-stone-400">{formatMs(batch.duration)}</span>
            {:else if batch.status === 'dispatching'}
              <span class="text-stone-700">→</span>
              <span class="text-xs font-mono text-stone-500 animate-pulse">fetching...</span>
            {:else if batch.status === 'pending'}
              <span class="text-stone-700">→</span>
              <span class="text-xs font-mono text-stone-600">waiting...</span>
            {/if}
          </div>
          
          <!-- Keys list -->
          <div class="flex flex-wrap gap-1">
            {#each batch.keys.slice(0, 8) as key}
              <span class="px-1.5 py-0.5 text-[9px] font-mono bg-stone-800 text-stone-400 border border-stone-700">
                {key}
              </span>
            {/each}
            {#if batch.keys.length > 8}
              <span class="px-1.5 py-0.5 text-[9px] font-mono text-stone-600">
                +{batch.keys.length - 8} more
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
