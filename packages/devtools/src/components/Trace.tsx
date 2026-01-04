import { Component, JSX } from 'solid-js';
import type { BatcherInfo } from '../core/types';

interface TraceProps {
  batcher: BatcherInfo | null;
}

const containerStyle: JSX.CSSProperties = {
  padding: '12px',
  height: '100%',
  'overflow-y': 'auto',
};

const emptyStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  height: '100%',
  color: '#57534e',
  'text-align': 'center',
};

const sectionStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
};

const labelStyle: JSX.CSSProperties = {
  color: '#78716c',
  'margin-bottom': '6px',
  'font-size': '10px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
};

const valueStyle: JSX.CSSProperties = {
  background: '#1c1917',
  padding: '8px 10px',
  'font-size': '11px',
  color: '#d6d3d1',
  border: '1px solid #292524',
};

const codeStyle: JSX.CSSProperties = {
  ...valueStyle,
  'white-space': 'pre-wrap',
  'word-break': 'break-all',
  'max-height': '300px',
  'overflow-y': 'auto',
  'font-family': 'ui-monospace, monospace',
};

const nameStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': '600',
  color: '#f5f5f4',
  'margin-bottom': '16px',
};

export const Trace: Component<TraceProps> = (props) => {
  const batcher = () => props.batcher;

  return (
    <div style={containerStyle}>
      {!batcher() ? (
        <div style={emptyStyle}>
          <div style={{ 'font-size': '11px', color: '#78716c', 'margin-bottom': '4px' }}>
            No batcher selected
          </div>
          <div style={{ 'font-size': '11px', color: '#57534e' }}>
            Click a batcher to see its trace info
          </div>
        </div>
      ) : (
        <>
          <div style={nameStyle}>
            {batcher()!.name}
            {batcher()!.isUnnamed && (
              <span style={{ color: '#78716c', 'font-weight': 'normal', 'font-style': 'italic' }}>
                {' '}(unnamed)
              </span>
            )}
          </div>

          {batcher()!.location && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Location</div>
              <div style={valueStyle}>{batcher()!.location}</div>
            </div>
          )}

          {batcher()!.fnSource && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Function</div>
              <div style={codeStyle}>{batcher()!.fnSource}</div>
            </div>
          )}

          {!batcher()!.location && !batcher()!.fnSource && (
            <div style={{ ...emptyStyle, height: 'auto', padding: '24px 0' }}>
              <div style={{ 'font-size': '11px', color: '#57534e' }}>
                No trace metadata available
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

