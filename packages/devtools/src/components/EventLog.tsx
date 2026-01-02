import { Component, For, Show, JSX } from 'solid-js';
import type { TraceEvent, TraceEventType } from '../core/types';

interface EventLogProps {
  events: TraceEvent[];
}

const eventLogStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '1px',
  'font-size': '11px',
};

const eventRowStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '4px 8px',
  background: '#1c1917',
};

const eventTimeStyle: JSX.CSSProperties = {
  color: '#57534e',
  'min-width': '60px',
};

const baseEventTypeStyle: JSX.CSSProperties = {
  'min-width': '60px',
  'font-weight': '500',
};

const eventTypeColors: Record<TraceEventType, string> = {
  get: '#60a5fa',
  dedup: '#c084fc',
  schedule: '#fbbf24',
  dispatch: '#22d3ee',
  resolve: '#4ade80',
  error: '#f87171',
  abort: '#a8a29e',
};

const eventDetailsStyle: JSX.CSSProperties = {
  color: '#78716c',
  flex: '1',
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
};

const emptyStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  height: '100%',
  color: '#57534e',
  'text-align': 'center',
  padding: '32px',
};

export const EventLog: Component<EventLogProps> = (props) => {
  const formatTime = (timestamp: number) => {
    const seconds = timestamp / 1000;
    return seconds.toFixed(3) + 's';
  };

  const getEventDetails = (event: TraceEvent): string => {
    switch (event.type) {
      case 'get':
        return `key: ${String(event.key)}`;
      case 'dedup':
        return `key: ${String(event.key)} (dedup)`;
      case 'schedule':
        return `batch: ${event.batchId}, size: ${event.size}`;
      case 'dispatch':
        return `batch: ${event.batchId}, keys: [${event.keys.map(String).join(', ')}]`;
      case 'resolve':
        return `batch: ${event.batchId}, ${event.duration.toFixed(1)}ms`;
      case 'error':
        return `batch: ${event.batchId}, ${event.error.message}`;
      case 'abort':
        return `batch: ${event.batchId}`;
      default:
        return '';
    }
  };

  const reversedEvents = () => [...props.events].reverse();

  return (
    <div style={eventLogStyle}>
      <Show
        when={reversedEvents().length > 0}
        fallback={
          <div style={emptyStyle}>
            <div style={{ 'font-size': '11px', color: '#78716c', 'margin-bottom': '4px' }}>
              No events
            </div>
            <div style={{ 'font-size': '11px', color: '#57534e' }}>
              Events appear as batchers process requests
            </div>
          </div>
        }
      >
        <For each={reversedEvents()}>
          {(event) => (
            <div style={eventRowStyle}>
              <span style={eventTimeStyle}>{formatTime(event.timestamp)}</span>
              <span style={{ ...baseEventTypeStyle, color: eventTypeColors[event.type] }}>
                {event.type}
              </span>
              <span style={eventDetailsStyle}>{getEventDetails(event)}</span>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};
