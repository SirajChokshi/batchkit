// Main function
export { batch } from './batch'

// Match helper for Record responses
export { indexed } from './indexed'

// Schedulers
export { onAnimationFrame, onIdle } from './schedulers'

// Error class
export { BatchError } from './errors'

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
} from './types'
