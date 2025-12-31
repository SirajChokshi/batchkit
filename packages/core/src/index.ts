// Main function
export { batch } from './batch';
// Error class
export { BatchError } from './errors';
// Match helper for Record responses
export { indexed } from './indexed';
// Schedulers
export { onAnimationFrame, onIdle } from './schedulers';

// Types
export type {
  Batcher,
  BatchFn,
  BatchOptions,
  GetOptions,
  Match,
  MatchFn,
  Scheduler,
  TraceEvent,
  TraceHandler,
} from './types';
