import type { Scheduler } from './types'

/**
 * Microtask scheduler - batches within a single event loop tick.
 * This is the default scheduler.
 */
export const microtask: Scheduler = (dispatch) => {
  let cancelled = false

  queueMicrotask(() => {
    if (!cancelled) {
      dispatch()
    }
  })

  return () => {
    cancelled = true
  }
}

/**
 * Creates a scheduler that waits a specified number of milliseconds.
 */
export function wait(ms: number): Scheduler {
  return (dispatch) => {
    const id = setTimeout(dispatch, ms)
    return () => clearTimeout(id)
  }
}

/**
 * Scheduler that dispatches on the next animation frame.
 * Good for render-related batching.
 *
 * @example
 * ```ts
 * const sprites = batch(fn, 'id', { schedule: onAnimationFrame })
 * ```
 */
export const onAnimationFrame: Scheduler = (dispatch) => {
  const id = requestAnimationFrame(dispatch)
  return () => cancelAnimationFrame(id)
}

/**
 * Creates a scheduler that dispatches when the browser is idle.
 * Good for background/low-priority work.
 *
 * @example
 * ```ts
 * const analytics = batch(fn, 'id', { schedule: onIdle })
 * const withTimeout = batch(fn, 'id', { schedule: onIdle({ timeout: 100 }) })
 * ```
 */
export function onIdle(options?: { timeout?: number }): Scheduler {
  return (dispatch) => {
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(
        dispatch,
        options?.timeout ? { timeout: options.timeout } : undefined
      )
      return () => cancelIdleCallback(id)
    }

    // Fallback for environments without requestIdleCallback
    const id = setTimeout(dispatch, options?.timeout ?? 1)
    return () => clearTimeout(id)
  }
}

// Also export as a direct scheduler for simple usage
export const idle: Scheduler = onIdle()
