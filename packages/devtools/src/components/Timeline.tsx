import { Component, For, Show, JSX } from 'solid-js';
import type { BatchInfo } from '../core/types';

interface TimelineProps {
  batches: BatchInfo[];
}

const timelineStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '1px',
};

const batchRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  padding: '6px 8px',
  background: '#1c1917',
  'font-size': '11px',
};

const batchIdStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#78716c',
  'min-width': '80px',
};

const baseStatusStyle: JSX.CSSProperties = {
  padding: '2px 6px',
  'font-size': '10px',
  'font-weight': '500',
  'text-transform': 'uppercase',
  'letter-spacing': '0.3px',
};

const statusStyles: Record<string, JSX.CSSProperties> = {
  scheduled: { ...baseStatusStyle, background: '#422006', color: '#fbbf24' },
  dispatching: { ...baseStatusStyle, background: '#1e3a5f', color: '#60a5fa' },
  resolved: { ...baseStatusStyle, background: '#14532d', color: '#4ade80' },
  error: { ...baseStatusStyle, background: '#450a0a', color: '#f87171' },
  aborted: { ...baseStatusStyle, background: '#292524', color: '#a8a29e' },
};

const batchKeysStyle: JSX.CSSProperties = {
  flex: '1',
  'font-size': '11px',
  color: '#a8a29e',
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
};

const batchDurationStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#57534e',
  'min-width': '50px',
  'text-align': 'right',
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

export const Timeline: Component<TimelineProps> = (props) => {
  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return '-';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatKeys = (keys: unknown[]) => {
    if (keys.length === 0) return '-';
    const preview = keys.slice(0, 3).map((k) => String(k)).join(', ');
    if (keys.length > 3) {
      return `${preview} +${keys.length - 3}`;
    }
    return preview;
  };

  const sortedBatches = () =>
    [...props.batches].sort((a, b) => b.scheduledAt - a.scheduledAt);

  return (
    <div style={timelineStyle}>
      <Show
        when={sortedBatches().length > 0}
        fallback={
          <div style={emptyStyle}>
            <div style={{ 'font-size': '11px', color: '#78716c', 'margin-bottom': '4px' }}>
              No batches yet
            </div>
            <div style={{ 'font-size': '11px', color: '#57534e' }}>
              Batches appear as requests are processed
            </div>
          </div>
        }
      >
        <For each={sortedBatches()}>
          {(batch) => (
            <div style={batchRowStyle}>
              <div style={batchIdStyle}>{batch.batchId}</div>
              <div style={statusStyles[batch.status] || baseStatusStyle}>{batch.status}</div>
              <div style={batchKeysStyle} title={batch.keys.map(String).join(', ')}>
                {formatKeys(batch.keys)}
              </div>
              <div style={batchDurationStyle}>{formatDuration(batch.duration)}</div>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};
