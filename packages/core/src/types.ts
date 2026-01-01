export type BatchFn<K, V> = (
  keys: K[],
  signal: AbortSignal,
) => Promise<V[] | Record<string, V>>;

export type Match<K, V> = keyof V | symbol | MatchFn<K, V>;

export type MatchFn<K, V> = (results: V[], key: K) => V | undefined;

export type IndexedMatchFn<K, V> = (
  results: Record<string, V>,
  key: K,
) => V | undefined;

export type Scheduler = (dispatch: () => void) => () => void;

export type TraceHandler<K = unknown> = (event: TraceEvent<K>) => void;

export type TraceEventData<K = unknown> =
  | { type: 'get'; key: K }
  | { type: 'dedup'; key: K }
  | { type: 'schedule'; batchId: string; size: number }
  | { type: 'dispatch'; batchId: string; keys: K[] }
  | { type: 'resolve'; batchId: string; duration: number }
  | { type: 'error'; batchId: string; error: Error }
  | { type: 'abort'; batchId: string };

export type TraceEvent<K = unknown> = TraceEventData<K> & { timestamp: number };

export interface BatchOptions<K = unknown> {
  wait?: number;
  schedule?: Scheduler;
  max?: number;
  key?: (k: K) => unknown;
  name?: string;
  trace?: TraceHandler<K>;
}

export interface GetOptions {
  signal?: AbortSignal;
}

export interface Batcher<K, V> {
  get(key: K, options?: GetOptions): Promise<V>;
  get(keys: K[], options?: GetOptions): Promise<V[]>;
  flush(): Promise<void>;
  abort(): void;
  readonly name?: string;
}

export interface PendingRequest<K, V> {
  key: K;
  resolve: (value: V) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  aborted: boolean;
}
