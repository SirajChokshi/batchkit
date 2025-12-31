// Core batcher
export { createBatcher } from './batcher'

// Schedulers
export {
  windowScheduler,
  animationFrameScheduler,
  idleScheduler,
} from './schedulers'

// Types
export type {
  Batcher,
  BatcherOptions,
  BatchInfo,
  BatchErrorInfo,
  PendingRequest,
  Scheduler,
  SchedulerType,
  WindowSchedulerOptions,
} from './types'

// Error classes
export { BatchError, ItemError } from './types'

// Telemetry (internal API for debugging/visualization)
export type {
  BatcherTelemetry,
  TelemetryEventMap,
  TelemetryEvent,
  TelemetryHandler,
} from './telemetry'
export { TelemetryEmitter, NoopTelemetry } from './telemetry'

