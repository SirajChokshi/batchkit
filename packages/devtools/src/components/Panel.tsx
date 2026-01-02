import { Component, createSignal, Show, JSX } from 'solid-js';
import { getRegistry, useStore, setOpen, setSelectedBatcher } from '../core/registry';
import { BatcherList } from './BatcherList';
import { Timeline } from './Timeline';
import { EventLog } from './EventLog';
import { Stats } from './Stats';
import { ToggleButton } from './ToggleButton';

type TabId = 'timeline' | 'events' | 'stats';

export interface PanelProps {
  buttonStyle?: JSX.CSSProperties;
  buttonClass?: string;
  panelStyle?: JSX.CSSProperties;
  panelClass?: string;
}

const panelBaseStyle: JSX.CSSProperties = {
  position: 'fixed',
  bottom: '72px',
  right: '16px',
  width: '640px',
  'max-width': 'calc(100vw - 32px)',
  height: '420px',
  'max-height': 'calc(100vh - 120px)',
  background: '#0c0a09',
  border: '1px solid #44403c',
  display: 'flex',
  'flex-direction': 'column',
  overflow: 'hidden',
  'z-index': '99998',
  'font-family': 'ui-monospace, monospace',
  color: '#d6d3d1',
};

const headerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '8px 12px',
  background: '#1c1917',
  'border-bottom': '1px solid #44403c',
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
  width: '180px',
  'border-right': '1px solid #44403c',
  display: 'flex',
  'flex-direction': 'column',
  background: '#0c0a09',
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

  const handleToggle = () => {
    setOpen(!store().isOpen);
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

  return (
    <>
      <ToggleButton
        isOpen={store().isOpen}
        onClick={handleToggle}
        style={props.buttonStyle}
        class={props.buttonClass}
      />

      <Show when={store().isOpen}>
        <div class={props.panelClass} style={{ ...panelBaseStyle, ...props.panelStyle }}>
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
              </div>

              <div style={contentAreaStyle}>
                <Show when={activeTab() === 'timeline'}>
                  <Timeline batches={filteredBatches()} />
                </Show>
                <Show when={activeTab() === 'events'}>
                  <EventLog events={filteredEvents()} />
                </Show>
                <Show when={activeTab() === 'stats'}>
                  <Stats events={filteredEvents()} batches={filteredBatches()} />
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};
