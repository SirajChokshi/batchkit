import { Component, JSX, Show } from 'solid-js';
import type { BatcherInfo, DevtoolsConfig } from '../core/types';
import { useStore } from '../core/registry';

interface TraceProps {
  batcher: BatcherInfo | null;
}

function parseLocationParts(location: string): { path: string; line?: number; column?: number } | null {
  // Handle URL-style locations (e.g., http://localhost:5173/src/file.ts:10:5)
  let cleanPath = location;
  
  // Strip protocol and host for URL-style paths
  const urlMatch = location.match(/^https?:\/\/[^/]+(.*)$/);
  if (urlMatch) {
    cleanPath = urlMatch[1];
  }
  
  // Strip query params (e.g., ?t=1234567890)
  cleanPath = cleanPath.split('?')[0];
  
  // Parse path:line:column format
  const match = cleanPath.match(/^(.+?):(\d+)(?::(\d+))?$/);
  if (!match) {
    return { path: cleanPath };
  }
  
  return {
    path: match[1],
    line: parseInt(match[2], 10),
    column: match[3] ? parseInt(match[3], 10) : undefined,
  };
}

function getEditorUrl(location: string, config: DevtoolsConfig): string | null {
  const parts = parseLocationParts(location);
  if (!parts) return null;
  
  let { path, line, column } = parts;
  
  // If path is relative (starts with / but not absolute), prepend projectRoot
  if (path.startsWith('/') && !path.startsWith('//') && config.projectRoot) {
    // Remove leading slash since projectRoot should be absolute
    path = config.projectRoot + path;
  } else if (!path.startsWith('/')) {
    // Relative path without leading slash
    if (config.projectRoot) {
      path = config.projectRoot + '/' + path;
    } else {
      return null;
    }
  }
  
  // Select editor protocol
  const editor = config.editor ?? 'vscode';
  const protocols: Record<string, string> = {
    vscode: 'vscode://file',
    cursor: 'cursor://file',
    webstorm: 'webstorm://open?file=',
    idea: 'idea://open?file=',
  };
  
  const protocol = protocols[editor];
  if (!protocol) return null;
  
  if (editor === 'webstorm' || editor === 'idea') {
    let url = `${protocol}${encodeURIComponent(path)}`;
    if (line !== undefined) {
      url += `&line=${line}`;
      if (column !== undefined) {
        url += `&column=${column}`;
      }
    }
    return url;
  }
  
  let url = `${protocol}${path}`;
  if (line !== undefined) {
    url += `:${line}`;
    if (column !== undefined) {
      url += `:${column}`;
    }
  }
  
  return url;
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

const linkStyle: JSX.CSSProperties = {
  ...valueStyle,
  display: 'block',
  color: '#93c5fd',
  'text-decoration': 'none',
  cursor: 'pointer',
};

const linkHoverStyle: JSX.CSSProperties = {
  'text-decoration': 'underline',
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
  const store = useStore();
  const config = () => store().config;

  return (
    <div style={containerStyle}>
      <Show
        when={props.batcher}
        fallback={
          <div style={emptyStyle}>
            <div style={{ 'font-size': '11px', color: '#78716c', 'margin-bottom': '4px' }}>
              No batcher selected
            </div>
            <div style={{ 'font-size': '11px', color: '#57534e' }}>
              Click a batcher to see its trace info
            </div>
          </div>
        }
      >
        {(batcher) => (
          <>
            <div style={nameStyle}>
              {batcher().name}
              {batcher().isUnnamed && (
                <span style={{ color: '#78716c', 'font-weight': 'normal', 'font-style': 'italic' }}>
                  {' '}(unnamed)
                </span>
              )}
            </div>

            <Show when={batcher().location}>
              {(location) => {
                const editorUrl = () => getEditorUrl(location(), config());
                return (
                  <div style={sectionStyle}>
                    <div style={labelStyle}>Location</div>
                    <Show
                      when={editorUrl()}
                      fallback={<div style={valueStyle}>{location()}</div>}
                    >
                      {(url) => (
                        <a
                          href={url()}
                          style={linkStyle}
                          onMouseOver={(e) => Object.assign(e.currentTarget.style, linkHoverStyle)}
                          onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {location()} ↗
                        </a>
                      )}
                    </Show>
                  </div>
                );
              }}
            </Show>

            <Show when={batcher().fnSource}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Function</div>
                <div style={codeStyle}>{batcher().fnSource}</div>
              </div>
            </Show>

            <Show when={!batcher().location && !batcher().fnSource}>
              <div style={{ ...emptyStyle, height: 'auto', padding: '24px 0' }}>
                <div style={{ 'font-size': '11px', color: '#57534e' }}>
                  No trace metadata available
                </div>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
};

