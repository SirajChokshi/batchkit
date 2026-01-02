export type TraceEventType =
  | 'get'
  | 'dedup'
  | 'schedule'
  | 'dispatch'
  | 'resolve'
  | 'error'
  | 'abort';

export interface TraceEventBase {
  type: TraceEventType;
  timestamp: number;
  batcherName: string;
}

export interface GetEvent extends TraceEventBase {
  type: 'get';
  key: unknown;
}

export interface DedupEvent extends TraceEventBase {
  type: 'dedup';
  key: unknown;
}

export interface ScheduleEvent extends TraceEventBase {
  type: 'schedule';
  batchId: string;
  size: number;
}

export interface DispatchEvent extends TraceEventBase {
  type: 'dispatch';
  batchId: string;
  keys: unknown[];
}

export interface ResolveEvent extends TraceEventBase {
  type: 'resolve';
  batchId: string;
  duration: number;
}

export interface ErrorEvent extends TraceEventBase {
  type: 'error';
  batchId: string;
  error: Error;
}

export interface AbortEvent extends TraceEventBase {
  type: 'abort';
  batchId: string;
}

export type TraceEvent =
  | GetEvent
  | DedupEvent
  | ScheduleEvent
  | DispatchEvent
  | ResolveEvent
  | ErrorEvent
  | AbortEvent;

export interface BatcherInfo {
  name: string;
  registeredAt: number;
}

export interface BatchInfo {
  batchId: string;
  batcherName: string;
  keys: unknown[];
  status: 'scheduled' | 'dispatching' | 'resolved' | 'error' | 'aborted';
  scheduledAt: number;
  dispatchedAt?: number;
  completedAt?: number;
  duration?: number;
  error?: Error;
}

export interface BatcherStats {
  totalGets: number;
  totalBatches: number;
  dedupedKeys: number;
  avgBatchSize: number;
  avgDuration: number;
}

export interface DevtoolsStore {
  batchers: Map<string, BatcherInfo>;
  events: TraceEvent[];
  batches: Map<string, BatchInfo>;
  selectedBatcher: string | null;
  isOpen: boolean;
}

export interface DevtoolsRegistry {
  register(info: BatcherInfo): void;
  unregister(name: string): void;
  emit(name: string, event: Omit<TraceEvent, 'batcherName'>): void;
  subscribe(listener: (store: DevtoolsStore) => void): () => void;
  getStore(): DevtoolsStore;
  clear(): void;
  _setStore?: (fn: (prev: DevtoolsStore) => DevtoolsStore) => void;
  _store?: () => DevtoolsStore;
}

declare global {
  interface Window {
    __BATCHKIT_DEVTOOLS__?: DevtoolsRegistry;
  }
}
