import {
  __setDevtoolsHook,
  type TraceEvent as CoreTraceEvent,
  type DevtoolsHook,
} from 'batchkit';
import { createRoot, createSignal } from 'solid-js';
import type {
  BatcherInfo,
  BatchInfo,
  DevtoolsRegistry,
  DevtoolsStore,
  TraceEvent,
} from './types';

let unnamedCounter = 0;

function parseLocation(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split('\n');
  for (const line of lines) {
    if (
      line.includes('batch') &&
      !line.includes('batchkit') &&
      !line.includes('node_modules')
    ) {
      const match = line.match(/at\s+.*?\s+\(?(.*?:\d+:\d+)\)?$/);
      if (match) return match[1];
    }
  }
  for (const line of lines.slice(2)) {
    if (!line.includes('batchkit') && !line.includes('node_modules')) {
      const match = line.match(/at\s+.*?\s+\(?(.*?:\d+:\d+)\)?$/);
      if (match) return match[1];
    }
  }
  return undefined;
}

function createDevtoolsRegistry(): DevtoolsRegistry {
  const [store, setStore] = createSignal<DevtoolsStore>({
    batchers: new Map(),
    events: [],
    batches: new Map(),
    selectedBatcher: null,
    isOpen: false,
  });

  const listeners = new Set<(store: DevtoolsStore) => void>();

  function notifyListeners() {
    const currentStore = store();
    for (const listener of listeners) {
      listener(currentStore);
    }
  }

  function register(info: BatcherInfo): void {
    setStore((prev) => {
      const newBatchers = new Map(prev.batchers);
      newBatchers.set(info.name, info);
      return { ...prev, batchers: newBatchers };
    });
    notifyListeners();
  }

  function emit(
    batcherName: string,
    event: Omit<TraceEvent, 'batcherName'>,
  ): void {
    const fullEvent = { ...event, batcherName } as TraceEvent;

    setStore((prev) => {
      const newEvents = [...prev.events, fullEvent];
      const newBatches = new Map(prev.batches);

      if (fullEvent.type === 'schedule') {
        const batchInfo: BatchInfo = {
          batchId: fullEvent.batchId,
          batcherName,
          keys: [],
          status: 'scheduled',
          scheduledAt: fullEvent.timestamp,
        };
        newBatches.set(fullEvent.batchId, batchInfo);
      }

      if (fullEvent.type === 'dispatch') {
        const existing = newBatches.get(fullEvent.batchId);
        if (existing) {
          newBatches.set(fullEvent.batchId, {
            ...existing,
            keys: fullEvent.keys,
            status: 'dispatching',
            dispatchedAt: fullEvent.timestamp,
          });
        }
      }

      if (fullEvent.type === 'resolve') {
        const existing = newBatches.get(fullEvent.batchId);
        if (existing) {
          newBatches.set(fullEvent.batchId, {
            ...existing,
            status: 'resolved',
            completedAt: fullEvent.timestamp,
            duration: fullEvent.duration,
          });
        }
      }

      if (fullEvent.type === 'error') {
        const existing = newBatches.get(fullEvent.batchId);
        if (existing) {
          newBatches.set(fullEvent.batchId, {
            ...existing,
            status: 'error',
            completedAt: fullEvent.timestamp,
            error: fullEvent.error,
          });
        }
      }

      if (fullEvent.type === 'abort') {
        const existing = newBatches.get(fullEvent.batchId);
        if (existing) {
          newBatches.set(fullEvent.batchId, {
            ...existing,
            status: 'aborted',
            completedAt: fullEvent.timestamp,
          });
        }
      }

      return { ...prev, events: newEvents, batches: newBatches };
    });
    notifyListeners();
  }

  function subscribe(listener: (store: DevtoolsStore) => void): () => void {
    listeners.add(listener);
    listener(store());
    return () => listeners.delete(listener);
  }

  function getStore(): DevtoolsStore {
    return store();
  }

  function clear(): void {
    setStore((prev) => ({
      ...prev,
      events: [],
      batches: new Map(),
    }));
    notifyListeners();
  }

  function open(): void {
    setStore((prev) => ({ ...prev, isOpen: true }));
    notifyListeners();
  }

  function close(): void {
    setStore((prev) => ({ ...prev, isOpen: false }));
    notifyListeners();
  }

  function toggle(): void {
    setStore((prev) => ({ ...prev, isOpen: !prev.isOpen }));
    notifyListeners();
  }

  const hook: DevtoolsHook = {
    onBatcherCreated({ fn, name, stack }) {
      const isUnnamed = !name;
      const batcherName = name ?? `unnamed-${++unnamedCounter}`;

      const fnSource = fn.toString().slice(0, 500);
      const location = parseLocation(stack);

      register({
        name: batcherName,
        registeredAt: performance.now(),
        isUnnamed,
        fnSource,
        location,
      });

      return (event: CoreTraceEvent) => {
        emit(batcherName, event as Omit<TraceEvent, 'batcherName'>);
      };
    },
  };

  __setDevtoolsHook(hook);

  return {
    subscribe,
    getStore,
    clear,
    open,
    close,
    toggle,
    _setStore: setStore,
    _store: store,
  };
}

let registryInstance: DevtoolsRegistry | null = null;

export function initRegistry(): DevtoolsRegistry {
  if (typeof window === 'undefined') {
    throw new Error('DevTools can only be used in browser environment');
  }

  if (!registryInstance) {
    registryInstance = createRoot(() => createDevtoolsRegistry());
  }

  return registryInstance;
}

export function getRegistry(): DevtoolsRegistry {
  if (!registryInstance) {
    throw new Error(
      'DevTools registry not initialized. Call initRegistry() first.',
    );
  }
  return registryInstance;
}

export function useStore() {
  const registry = getRegistry() as DevtoolsRegistry & {
    _store?: () => DevtoolsStore;
  };

  if (registry._store) {
    return registry._store;
  }

  const [localStore, setLocalStore] = createSignal(registry.getStore());
  registry.subscribe(setLocalStore);
  return localStore;
}

export function setSelectedBatcher(name: string | null) {
  if (registryInstance) {
    registryInstance._setStore?.((prev) => ({
      ...prev,
      selectedBatcher: name,
    }));
  }
}
