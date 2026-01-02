import { Component, createMemo, JSX } from 'solid-js';
import type { BatchInfo, TraceEvent } from '../core/types';

interface StatsProps {
  events: TraceEvent[];
  batches: BatchInfo[];
}

const gridStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '1px',
  background: '#292524',
};

const cardStyle: JSX.CSSProperties = {
  padding: '12px',
  background: '#1c1917',
};

const labelStyle: JSX.CSSProperties = {
  'font-size': '11px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
  color: '#78716c',
  'margin-bottom': '4px',
};

const valueStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': '500',
  color: '#f5f5f4',
};

const unitStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#57534e',
  'margin-left': '2px',
};

export const Stats: Component<StatsProps> = (props) => {
  const stats = createMemo(() => {
    const events = props.events;
    const batches = props.batches;

    const totalGets = events.filter((e) => e.type === 'get').length;
    const dedupedKeys = events.filter((e) => e.type === 'dedup').length;
    const completedBatches = batches.filter((b) => b.status === 'resolved');
    const totalBatches = completedBatches.length;

    const avgBatchSize =
      totalBatches > 0
        ? completedBatches.reduce((sum, b) => sum + b.keys.length, 0) / totalBatches
        : 0;

    const avgDuration =
      totalBatches > 0
        ? completedBatches.reduce((sum, b) => sum + (b.duration || 0), 0) / totalBatches
        : 0;

    const errors = batches.filter((b) => b.status === 'error').length;
    const aborts = batches.filter((b) => b.status === 'aborted').length;

    const dedupRate = totalGets > 0 ? (dedupedKeys / totalGets) * 100 : 0;

    return {
      totalGets,
      totalBatches,
      dedupedKeys,
      avgBatchSize,
      avgDuration,
      errors,
      aborts,
      dedupRate,
    };
  });

  return (
    <div style={gridStyle}>
      <div style={cardStyle}>
        <div style={labelStyle}>Gets</div>
        <div style={valueStyle}>{stats().totalGets}</div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Batches</div>
        <div style={valueStyle}>{stats().totalBatches}</div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Deduped</div>
        <div style={valueStyle}>
          {stats().dedupedKeys}
          <span style={unitStyle}>({stats().dedupRate.toFixed(0)}%)</span>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Avg Size</div>
        <div style={valueStyle}>{stats().avgBatchSize.toFixed(1)}</div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Avg Time</div>
        <div style={valueStyle}>
          {stats().avgDuration.toFixed(0)}
          <span style={unitStyle}>ms</span>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Err / Abort</div>
        <div style={valueStyle}>
          <span style={{ color: stats().errors > 0 ? '#f87171' : '#f5f5f4' }}>
            {stats().errors}
          </span>
          <span style={{ color: '#57534e' }}> / </span>
          <span style={{ color: stats().aborts > 0 ? '#fbbf24' : '#f5f5f4' }}>
            {stats().aborts}
          </span>
        </div>
      </div>
    </div>
  );
};
