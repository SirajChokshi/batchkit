<script lang="ts">
  import type { TimelineEvent } from '../lib/useBatcherTelemetry.svelte'
  import type { TraceEvent } from 'batchkit'

  interface Props {
    events: TimelineEvent[]
  }

  let { events }: Props = $props()

  // Show most recent events first, limited to last 50
  const displayEvents = $derived(
    [...events].reverse().slice(0, 50)
  )

  function getEventIcon(type: string): string {
    switch (type) {
      case 'get': return '→'
      case 'dedup': return '⊕'
      case 'schedule': return '◎'
      case 'dispatch': return '▶'
      case 'resolve': return '✓'
      case 'error': return '✗'
      case 'abort': return '⊘'
      default: return '•'
    }
  }

  function getIconColor(type: string): string {
    if (type === 'get' || type === 'dedup') return 'text-stone-100'
    if (type === 'schedule' || type === 'dispatch' || type === 'resolve') return 'text-stone-400'
    if (type === 'error') return 'text-stone-300'
    return 'text-stone-600'
  }

  function getTypeColor(type: string): string {
    if (type === 'get' || type === 'dedup') return 'text-stone-100'
    if (type === 'schedule' || type === 'dispatch' || type === 'resolve') return 'text-stone-400'
    if (type === 'error') return 'text-stone-300'
    return 'text-stone-600'
  }

  function formatEventData(event: TimelineEvent): string {
    const data = event.data as TraceEvent
    switch (data.type) {
      case 'get':
      case 'dedup':
        return `key="${data.key}"`
      case 'schedule':
        return `batch=${data.batchId.split('-').pop()}, size=${data.size}`
      case 'dispatch':
        return `batch=${data.batchId.split('-').pop()}, keys=${data.keys.length}`
      case 'resolve':
        return `batch=${data.batchId.split('-').pop()}, ${data.duration.toFixed(0)}ms`
      case 'error':
        return `batch=${data.batchId.split('-').pop()}, error="${data.error.message}"`
      case 'abort':
        return `batch=${data.batchId.split('-').pop()}`
      default:
        return ''
    }
  }
</script>

<div class="bg-stone-900 p-4 flex-1 min-h-[200px] flex flex-col">
  <h3 class="text-xs uppercase tracking-wide text-stone-500 mb-3 font-mono">Event Log</h3>
  
  <div class="flex-1 overflow-hidden flex flex-col">
    {#if events.length === 0}
      <div class="text-center py-8 text-stone-500 text-sm font-mono">
        <p>No events yet</p>
      </div>
    {:else}
      <div class="font-mono text-xs leading-relaxed overflow-y-auto max-h-[300px]">
        {#each displayEvents as event (event.id)}
          <div class="flex gap-3 py-0.5">
            <span class="text-stone-600 whitespace-pre">{event.relativeTime.toFixed(0).padStart(6, ' ')}ms</span>
            <span class="w-4 text-center {getIconColor(event.type)}">{getEventIcon(event.type)}</span>
            <span class="min-w-[80px] {getTypeColor(event.type)}">{event.type}</span>
            <span class="text-stone-600">{formatEventData(event)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
