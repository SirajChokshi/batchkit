import { Component, createSignal, onMount, JSX } from 'solid-js';
import { getRegistry, useStore, setSelectedBatcher } from '../core/registry';
import { BatcherList } from './BatcherList';
import { Timeline } from './Timeline';
import { EventLog } from './EventLog';
import { Stats } from './Stats';
import { Trace } from './Trace';
import { ToggleButton } from './ToggleButton';

type TabId = 'timeline' | 'events' | 'stats' | 'trace';
type Position = 'right' | 'bottom' | 'left';

export interface PanelProps {
  position?: Position;
  defaultOpen?: boolean;
  buttonStyle?: JSX.CSSProperties;
  buttonClass?: string;
  panelStyle?: JSX.CSSProperties;
  panelClass?: string;
}

const STORAGE_KEY = 'batchkit-devtools';
const DEFAULT_WIDTH = 650;
const DEFAULT_HEIGHT = 350;
const MIN_SIZE = 200;
const MAX_SIZE = 1200;
const TRANSITION_DURATION = '0.2s';

interface StoredState {
  isOpen?: boolean;
  width?: number;
  height?: number;
}

function loadState(): StoredState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveState(state: StoredState): void {
  try {
    const current = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch {
    // ignore
  }
}

function getDrawerBaseStyle(position: Position, size: number, isResizing: boolean): JSX.CSSProperties {
  const base: JSX.CSSProperties = {
    position: 'fixed',
    background: '#0c0a09',
    'border-color': '#44403c',
    'border-style': 'solid',
    'border-width': '0',
    display: 'flex',
    'flex-direction': 'column',
    overflow: 'hidden',
    'z-index': '99998',
    'font-family': 'ui-monospace, monospace',
    color: '#d6d3d1',
    transition: isResizing ? 'none' : `transform ${TRANSITION_DURATION} ease-out`,
    'box-shadow': '0 0 10px 0 rgba(0, 0, 0, 0.1)',
  };

  switch (position) {
    case 'right':
      return {
        ...base,
        top: '0',
        right: '0',
        width: `${size}px`,
        height: '100vh',
        'border-left-width': '1px',
      };
    case 'left':
      return {
        ...base,
        top: '0',
        left: '0',
        width: `${size}px`,
        height: '100vh',
        'border-right-width': '1px',
      };
    case 'bottom':
      return {
        ...base,
        bottom: '0',
        left: '0',
        right: '0',
        width: '100%',
        height: `${size}px`,
        'border-top-width': '1px',
      };
  }
}

function getResizeHandleStyle(position: Position): JSX.CSSProperties {
  const base: JSX.CSSProperties = {
    position: 'absolute',
    background: 'transparent',
    'z-index': '99999',
  };

  switch (position) {
    case 'right':
      return {
        ...base,
        left: '0',
        top: '0',
        bottom: '0',
        width: '6px',
        cursor: 'ew-resize',
      };
    case 'left':
      return {
        ...base,
        right: '0',
        top: '0',
        bottom: '0',
        width: '6px',
        cursor: 'ew-resize',
      };
    case 'bottom':
      return {
        ...base,
        top: '0',
        left: '0',
        right: '0',
        height: '6px',
        cursor: 'ns-resize',
      };
  }
}

function getTransform(position: Position, isOpen: boolean): string {
  if (isOpen) return 'translate(0, 0)';

  switch (position) {
    case 'right':
      return 'translateX(100%)';
    case 'left':
      return 'translateX(-100%)';
    case 'bottom':
      return 'translateY(100%)';
  }
}

const headerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '8px 12px',
  background: '#1c1917',
  'border-bottom': '1px solid #44403c',
  'flex-shrink': '0',
  'user-select': 'none',
};

const titleStyle: JSX.CSSProperties = {
  'font-size': '11px',
  'font-weight': '500',
  color: '#a8a29e',
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
};

const clearButtonStyle: JSX.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #44403c',
  background: '#1c1917',
  color: '#78716c',
  'font-size': '11px',
  'font-family': 'ui-monospace, monospace',
  cursor: 'pointer',
};

const bodyStyle: JSX.CSSProperties = {
  display: 'flex',
  flex: '1',
  'min-height': '0',
};

const sidebarStyle: JSX.CSSProperties = {
  width: '160px',
  'border-right': '1px solid #44403c',
  display: 'flex',
  'flex-direction': 'column',
  background: '#0c0a09',
  'flex-shrink': '0',
  'user-select': 'none',
};

const sidebarHeaderStyle: JSX.CSSProperties = {
  padding: '8px 12px',
  'font-size': '11px',
  'font-weight': '500',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
  color: '#78716c',
  'border-bottom': '1px solid #292524',
};

const mainContentStyle: JSX.CSSProperties = {
  flex: '1',
  display: 'flex',
  'flex-direction': 'column',
  'min-width': '0',
};

const tabBarStyle: JSX.CSSProperties = {
  display: 'flex',
  'border-bottom': '1px solid #44403c',
  background: '#1c1917',
  'flex-shrink': '0',
  'user-select': 'none',
};

const tabStyle: JSX.CSSProperties = {
  padding: '8px 12px',
  'font-size': '11px',
  'font-weight': '500',
  color: '#78716c',
  cursor: 'pointer',
  'border-bottom': '1px solid transparent',
  'margin-bottom': '-1px',
  background: 'transparent',
  border: 'none',
  'font-family': 'ui-monospace, monospace',
};

const tabActiveStyle: JSX.CSSProperties = {
  ...tabStyle,
  color: '#f5f5f4',
  'border-bottom': '1px solid #f5f5f4',
};

const contentAreaStyle: JSX.CSSProperties = {
  flex: '1',
  overflow: 'auto',
  padding: '12px',
  background: '#0c0a09',
};

export const Panel: Component<PanelProps> = (props) => {
  const store = useStore();
  const [activeTab, setActiveTab] = createSignal<TabId>('timeline');
  const [isResizing, setIsResizing] = createSignal(false);
  const position = () => props.position ?? 'right';

  const isHorizontal = () => position() === 'bottom';
  const defaultSize = () => isHorizontal() ? DEFAULT_HEIGHT : DEFAULT_WIDTH;

  const [size, setSize] = createSignal(defaultSize());

  onMount(() => {
    const stored = loadState();

    if (stored.isOpen !== undefined) {
      if (stored.isOpen) {
        getRegistry().open();
      }
    } else if (props.defaultOpen) {
      getRegistry().open();
    }

    const storedSize = isHorizontal() ? stored.height : stored.width;
    if (storedSize && storedSize >= MIN_SIZE && storedSize <= MAX_SIZE) {
      setSize(storedSize);
    }
  });

  const handleToggle = () => {
    getRegistry().toggle();
    saveState({ isOpen: !store().isOpen });
  };

  const handleResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startPos = isHorizontal() ? e.clientY : e.clientX;
    const startSize = size();
    const pos = position();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = isHorizontal() ? moveEvent.clientY : moveEvent.clientX;
      let delta = startPos - currentPos;

      if (pos === 'left') {
        delta = -delta;
      }
      if (pos === 'bottom') {
        delta = delta;
      }

      const newSize = Math.min(MAX_SIZE, Math.max(MIN_SIZE, startSize + delta));
      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      saveState(isHorizontal() ? { height: size() } : { width: size() });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = isHorizontal() ? 'ns-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const handleClear = () => {
    getRegistry().clear();
  };

  const selectedBatcher = () => store().selectedBatcher;
  const batchers = () => store().batchers;
  const events = () => store().events;
  const batches = () => store().batches;

  const selectedBatcherInfo = () => {
    const selected = selectedBatcher();
    if (!selected) return null;
    return batchers().get(selected) ?? null;
  };

  const filteredEvents = () => {
    const selected = selectedBatcher();
    if (!selected) return events();
    return events().filter((e) => e.batcherName === selected);
  };

  const filteredBatches = () => {
    const selected = selectedBatcher();
    if (!selected) return Array.from(batches().values());
    return Array.from(batches().values()).filter((b) => b.batcherName === selected);
  };

  const drawerStyle = (): JSX.CSSProperties => ({
    ...getDrawerBaseStyle(position(), size(), isResizing()),
    transform: getTransform(position(), store().isOpen),
    ...props.panelStyle,
  });

  return (
    <>
      <ToggleButton
        isOpen={store().isOpen}
        onClick={handleToggle}
        style={props.buttonStyle}
        class={props.buttonClass}
      />

      <div class={props.panelClass} style={drawerStyle()}>
          <div
            style={getResizeHandleStyle(position())}
            onMouseDown={handleResizeStart}
            onMouseOver={(e) => e.currentTarget.style.background = '#44403c'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          />
          <div style={headerStyle}>
            <div style={titleStyle}>
              <span style={{ color: '#78716c' }}>[=]</span>
              Devtools
            </div>
            <button style={clearButtonStyle} onClick={handleClear}>
              Clear
            </button>
          </div>

          <div style={bodyStyle}>
            <div style={sidebarStyle}>
              <div style={sidebarHeaderStyle}>Batchers</div>
              <BatcherList
                batchers={batchers()}
                events={events()}
                selectedBatcher={selectedBatcher()}
                onSelect={setSelectedBatcher}
              />
            </div>

            <div style={mainContentStyle}>
              <div style={tabBarStyle}>
                <button
                  style={activeTab() === 'timeline' ? tabActiveStyle : tabStyle}
                  onClick={() => setActiveTab('timeline')}
                >
                  Timeline
                </button>
                <button
                  style={activeTab() === 'events' ? tabActiveStyle : tabStyle}
                  onClick={() => setActiveTab('events')}
                >
                  Events
                </button>
                <button
                  style={activeTab() === 'stats' ? tabActiveStyle : tabStyle}
                  onClick={() => setActiveTab('stats')}
                >
                  Stats
                </button>
                <button
                  style={activeTab() === 'trace' ? tabActiveStyle : tabStyle}
                  onClick={() => setActiveTab('trace')}
                >
                  Trace
                </button>
              </div>

              <div style={contentAreaStyle}>
              {activeTab() === 'timeline' && <Timeline batches={filteredBatches()} />}
              {activeTab() === 'events' && <EventLog events={filteredEvents()} />}
              {activeTab() === 'stats' && <Stats events={filteredEvents()} batches={filteredBatches()} />}
              {activeTab() === 'trace' && <Trace batcher={selectedBatcherInfo()} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
