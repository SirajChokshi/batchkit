import { Component, JSX, Show, createSignal } from 'solid-js';
import type { BatcherInfo, DevtoolsConfig } from '../core/types';
import { useStore } from '../core/registry';

interface TraceProps {
  batcher: BatcherInfo | null;
}

function parseLocationParts(location: string): { path: string; line?: number; column?: number } | null {
  let cleanPath = location;
  
  // Strip protocol and host for URL-style paths (e.g., http://localhost:5173/src/file.ts:10:5)
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
  if (!config.projectRoot) return null;
  
  const parts = parseLocationParts(location);
  if (!parts) return null;
  
  let { path, line, column } = parts;
  
  // Prepend projectRoot to relative paths
  if (path.startsWith('/') && !path.startsWith('//')) {
    path = config.projectRoot + path;
  } else if (!path.startsWith('/')) {
    path = config.projectRoot + '/' + path;
  }
  
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

function formatDisplayLocation(location: string): string {
  const parts = parseLocationParts(location);
  if (!parts) return location;
  
  let display = parts.path;
  // Shorten long paths - show last 2-3 segments
  const segments = display.split('/').filter(Boolean);
  if (segments.length > 3) {
    display = '.../' + segments.slice(-3).join('/');
  }
  
  if (parts.line !== undefined) {
    display += `:${parts.line}`;
    if (parts.column !== undefined) {
      display += `:${parts.column}`;
    }
  }
  
  return display;
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
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '8px',
  color: '#93c5fd',
  'text-decoration': 'none',
  cursor: 'pointer',
};

const copyButtonStyle: JSX.CSSProperties = {
  padding: '2px 6px',
  background: '#292524',
  border: '1px solid #44403c',
  color: '#78716c',
  'font-size': '10px',
  cursor: 'pointer',
  'flex-shrink': '0',
};

const hintStyle: JSX.CSSProperties = {
  'font-size': '10px',
  color: '#57534e',
  'margin-top': '6px',
  'font-style': 'italic',
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
  const [copied, setCopied] = createSignal(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

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
                const displayLocation = () => formatDisplayLocation(location());
                const hasEditorConfig = () => Boolean(config().projectRoot);
                
                return (
                  <div style={sectionStyle}>
                    <div style={labelStyle}>Location</div>
                    <Show
                      when={editorUrl()}
                      fallback={
                        <div>
                          <div 
                            style={{ ...valueStyle, display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', gap: '8px' }}
                            title={location()}
                          >
                            <span style={{ overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                              {displayLocation()}
                            </span>
                            <button
                              style={copyButtonStyle}
                              onClick={() => copyToClipboard(location())}
                              onMouseOver={(e) => { e.currentTarget.style.background = '#44403c'; e.currentTarget.style.color = '#a8a29e'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = '#292524'; e.currentTarget.style.color = '#78716c'; }}
                              onMouseDown={(e) => { e.currentTarget.style.background = '#57534e'; }}
                              onMouseUp={(e) => { e.currentTarget.style.background = '#44403c'; }}
                            >
                              {copied() ? '✓' : 'Copy'}
                            </button>
                          </div>
                          <Show when={!hasEditorConfig()}>
                            <div style={hintStyle}>
                              Set projectRoot to enable click-to-open
                            </div>
                          </Show>
                        </div>
                      }
                    >
                      {(url) => (
                        <a
                          href={url()}
                          style={linkStyle}
                          title={`Open in ${config().editor ?? 'vscode'}`}
                          onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          <span style={{ overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                            {displayLocation()}
                          </span>
                          <span style={{ color: '#57534e', 'flex-shrink': '0' }}>↗ Open</span>
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

