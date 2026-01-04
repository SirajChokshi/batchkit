import { Component, For, createMemo, JSX } from 'solid-js';
import type { BatcherInfo, TraceEvent } from '../core/types';

interface BatcherListProps {
  batchers: Map<string, BatcherInfo>;
  events: TraceEvent[];
  selectedBatcher: string | null;
  onSelect: (name: string | null) => void;
}

const listStyle: JSX.CSSProperties = {
  flex: '1',
  'overflow-y': 'auto',
};

const itemStyle: JSX.CSSProperties = {
  padding: '8px 12px',
  cursor: 'pointer',
  'border-bottom': '1px solid #292524',
  'border-left': '2px solid transparent',
};

const itemSelectedStyle: JSX.CSSProperties = {
  ...itemStyle,
  background: '#1c1917',
  'border-left-color': '#a8a29e',
};

const nameStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#d6d3d1',
  'margin-bottom': '2px',
};

const unnamedStyle: JSX.CSSProperties = {
  ...nameStyle,
  color: '#78716c',
  'font-style': 'italic',
};

const statsStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#78716c',
};

const statStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '4px',
  'margin-right': '8px',
};

const emptyStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  height: '100%',
  color: '#57534e',
  'text-align': 'center',
  padding: '24px 12px',
};

export const BatcherList: Component<BatcherListProps> = (props) => {
  const batcherArray = createMemo(() => Array.from(props.batchers.values()));

  const getStats = (name: string) => {
    const batcherEvents = props.events.filter((e) => e.batcherName === name);
    const gets = batcherEvents.filter((e) => e.type === 'get').length;
    const batches = batcherEvents.filter((e) => e.type === 'resolve').length;
    return { gets, batches };
  };

  const handleSelect = (name: string) => {
    if (props.selectedBatcher === name) {
      props.onSelect(null);
    } else {
      props.onSelect(name);
    }
  };

  return (
    <div style={listStyle}>
      <For each={batcherArray()}>
        {(batcher) => {
          const stats = () => getStats(batcher.name);
          const isSelected = () => props.selectedBatcher === batcher.name;

          return (
            <div
              style={isSelected() ? itemSelectedStyle : itemStyle}
              onClick={() => handleSelect(batcher.name)}
            >
              <div style={batcher.isUnnamed ? unnamedStyle : nameStyle}>
                {batcher.name}
              </div>
              <div style={statsStyle}>
                <span style={statStyle}>{stats().gets} gets</span>
                <span style={statStyle}>{stats().batches} batches</span>
              </div>
            </div>
          );
        }}
      </For>

      {batcherArray().length === 0 && (
        <div style={emptyStyle}>
          <div style={{ 'font-size': '11px', color: '#78716c', 'margin-bottom': '4px' }}>
            No batchers yet
          </div>
          <div style={{ 'font-size': '11px', color: '#57534e' }}>
            Call batch() to see it here
          </div>
        </div>
      )}
    </div>
  );
};
