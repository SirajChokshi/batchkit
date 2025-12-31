<script lang="ts">
  import type { TimelineEvent } from '../lib/useBatcherTelemetry.svelte'
  import type { TelemetryEventMap } from 'batchkit'

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
      case 'load:called': return '→'
      case 'load:deduped': return '⊕'
      case 'load:cached': return '⚡'
      case 'batch:scheduled': return '◎'
      case 'batch:dispatching': return '▶'
      case 'batch:resolved': return '✓'
      case 'batch:error': return '✗'
      case 'cache:primed': return '+'
      case 'cache:cleared': return '-'
      case 'cache:cleared-all': return '⌀'
      default: return '•'
    }
  }

  function getEventClass(type: string): string {
    if (type === 'batch:error') return 'event-error'
    if (type.startsWith('load:')) return 'event-load'
    if (type.startsWith('batch:')) return 'event-batch'
    if (type.startsWith('cache:')) return 'event-cache'
    return ''
  }

  function formatEventData(event: TimelineEvent): string {
    const data = event.data
    switch (event.type) {
      case 'load:called':
      case 'load:deduped':
      case 'load:cached':
      case 'cache:primed':
      case 'cache:cleared':
        return `key="${(data as TelemetryEventMap['load:called']).key}"`
      case 'batch:dispatching':
        return `batch=${(data as TelemetryEventMap['batch:dispatching']).batchId.split('-').pop()}, keys=${(data as TelemetryEventMap['batch:dispatching']).keys.length}`
      case 'batch:resolved':
        return `batch=${(data as TelemetryEventMap['batch:resolved']).batchId.split('-').pop()}, ${(data as TelemetryEventMap['batch:resolved']).duration.toFixed(0)}ms`
      case 'batch:error':
        return `batch=${(data as TelemetryEventMap['batch:error']).batchId.split('-').pop()}, error="${(data as TelemetryEventMap['batch:error']).error.message}"`
      default:
        return ''
    }
  }
</script>

<div class="event-log">
  <h3>Event Log</h3>
  
  <div class="log-container">
    {#if events.length === 0}
      <div class="empty-state">
        <p>No events yet</p>
      </div>
    {:else}
      <div class="log-entries">
        {#each displayEvents as event (event.id)}
          <div class="log-entry {getEventClass(event.type)}">
            <span class="timestamp">{event.relativeTime.toFixed(0).padStart(6, ' ')}ms</span>
            <span class="icon">{getEventIcon(event.type)}</span>
            <span class="type">{event.type}</span>
            <span class="data">{formatEventData(event)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .event-log {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    flex: 1;
    min-height: 200px;
    display: flex;
    flex-direction: column;
  }

  h3 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }

  .log-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .log-entries {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.8;
    overflow-y: auto;
    max-height: 300px;
  }

  .log-entry {
    display: flex;
    gap: 0.75rem;
    padding: 0.125rem 0;
    animation: slideIn 0.15s ease;
  }

  @keyframes slideIn {
    from { 
      opacity: 0;
      transform: translateX(-10px);
    }
    to { 
      opacity: 1;
      transform: translateX(0);
    }
  }

  .timestamp {
    color: var(--text-muted);
    white-space: pre;
  }

  .icon {
    width: 1rem;
    text-align: center;
  }

  .type {
    color: var(--text-secondary);
    min-width: 120px;
  }

  .data {
    color: var(--text-muted);
  }

  .event-load .icon {
    color: var(--accent-primary);
  }

  .event-load .type {
    color: var(--accent-primary);
  }

  .event-batch .icon {
    color: var(--accent-secondary);
  }

  .event-batch .type {
    color: var(--accent-secondary);
  }

  .event-cache .icon {
    color: var(--accent-success);
  }

  .event-cache .type {
    color: var(--accent-success);
  }

  .event-error .icon,
  .event-error .type {
    color: var(--accent-error);
  }
</style>

