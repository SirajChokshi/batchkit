import { createRoot, createSignal } from 'solid-js';
import type {
  BatcherInfo,
  BatchInfo,
  DevtoolsRegistry,
  DevtoolsStore,
  TraceEvent,
} from './types';

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

  function unregister(name: string): void {
    setStore((prev) => {
      const newBatchers = new Map(prev.batchers);
      newBatchers.delete(name);
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

  return {
    register,
    unregister,
    emit,
    subscribe,
    getStore,
    clear,
    _setStore: setStore,
    _store: store,
  };
}

export function getRegistry(): DevtoolsRegistry {
  if (typeof window === 'undefined') {
    throw new Error('DevTools can only be used in browser environment');
  }

  if (!window.__BATCHKIT_DEVTOOLS__) {
    window.__BATCHKIT_DEVTOOLS__ = createRoot(() => createDevtoolsRegistry());
  }

  return window.__BATCHKIT_DEVTOOLS__;
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

export function setOpen(isOpen: boolean) {
  if (typeof window !== 'undefined' && window.__BATCHKIT_DEVTOOLS__) {
    const registry = window.__BATCHKIT_DEVTOOLS__ as DevtoolsRegistry & {
      _setStore?: (fn: (prev: DevtoolsStore) => DevtoolsStore) => void;
    };
    registry._setStore?.((prev) => ({ ...prev, isOpen }));
  }
}

export function setSelectedBatcher(name: string | null) {
  if (typeof window !== 'undefined' && window.__BATCHKIT_DEVTOOLS__) {
    const registry = window.__BATCHKIT_DEVTOOLS__ as DevtoolsRegistry & {
      _setStore?: (fn: (prev: DevtoolsStore) => DevtoolsStore) => void;
    };
    registry._setStore?.((prev) => ({ ...prev, selectedBatcher: name }));
  }
}
