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

const DRAWER_WIDTH = '650px';
const DRAWER_HEIGHT = '350px';
const TRANSITION_DURATION = '0.2s';

function getDrawerBaseStyle(position: Position): JSX.CSSProperties {
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
    transition: `transform ${TRANSITION_DURATION} ease-out`,
    'box-shadow': '0 0 10px 0 rgba(0, 0, 0, 0.1)',
  };

  switch (position) {
    case 'right':
      return {
        ...base,
        top: '0',
        right: '0',
        width: DRAWER_WIDTH,
        height: '100vh',
        'border-left-width': '1px',
        'box-shadow': '0 0 10px 0 rgba(0, 0, 0, 0.1)',
      };
    case 'left':
      return {
        ...base,
        top: '0',
        left: '0',
        width: DRAWER_WIDTH,
        height: '100vh',
        'border-right-width': '1px',
        'box-shadow': '0 0 10px 0 rgba(0, 0, 0, 0.1)',
      };
    case 'bottom':
      return {
        ...base,
        bottom: '0',
        left: '0',
        right: '0',
        width: '100%',
        height: DRAWER_HEIGHT,
        'border-top-width': '1px',
        'box-shadow': '0 0 10px 0 rgba(0, 0, 0, 0.1)',
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
  const position = () => props.position ?? 'right';

  onMount(() => {
    if (props.defaultOpen) {
      getRegistry().open();
    }
  });

  const handleToggle = () => {
    getRegistry().toggle();
  };

  const handleClear = () => {
    getRegistry().clear();
  };

  const selectedBatcher = () => store().selectedBatcher;
  const batchers = () => store().batchers;
  const events = () => store().events;
  const batches = () => store().batches;

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
    ...getDrawerBaseStyle(position()),
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
              {activeTab() === 'trace' && <Trace batcher={selectedBatcher() ? batchers().get(selectedBatcher()!) ?? null : null} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
