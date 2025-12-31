import type { Scheduler, WindowSchedulerOptions } from './types'

/**
 * Creates a window-based scheduler that batches requests within a time window.
 * Useful when you want to collect requests over a period of time before dispatching.
 *
 * @param options - Configuration for the window scheduler
 * @returns A scheduler function
 *
 * @example
 * ```ts
 * const batcher = createBatcher({
 *   resolver: async (keys) => fetchItems(keys),
 *   scheduler: windowScheduler({ wait: 10 }) // 10ms window
 * })
 * ```
 */
export function windowScheduler(options: WindowSchedulerOptions): Scheduler {
  const { wait } = options

  return (dispatch) => {
    const timeoutId = setTimeout(() => {
      dispatch()
    }, wait)

    return () => {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Creates a scheduler that batches requests until the next animation frame.
 * Useful for UI-related batching where you want to sync with rendering.
 *
 * @returns A scheduler function
 *
 * @example
 * ```ts
 * const batcher = createBatcher({
 *   resolver: async (keys) => fetchItems(keys),
 *   scheduler: animationFrameScheduler()
 * })
 * ```
 */
export function animationFrameScheduler(): Scheduler {
  return (dispatch) => {
    const frameId = requestAnimationFrame(() => {
      dispatch()
    })

    return () => {
      cancelAnimationFrame(frameId)
    }
  }
}

/**
 * Creates a scheduler that batches requests until idle.
 * Uses requestIdleCallback when available, falls back to setTimeout.
 *
 * @param options - Optional timeout configuration
 * @returns A scheduler function
 *
 * @example
 * ```ts
 * const batcher = createBatcher({
 *   resolver: async (keys) => fetchItems(keys),
 *   scheduler: idleScheduler({ timeout: 100 })
 * })
 * ```
 */
export function idleScheduler(options?: { timeout?: number }): Scheduler {
  return (dispatch) => {
    if (typeof requestIdleCallback !== 'undefined') {
      const idleId = requestIdleCallback(
        () => {
          dispatch()
        },
        options?.timeout ? { timeout: options.timeout } : undefined
      )

      return () => {
        cancelIdleCallback(idleId)
      }
    }

    // Fallback to setTimeout for environments without requestIdleCallback
    const timeoutId = setTimeout(() => {
      dispatch()
    }, options?.timeout ?? 1)

    return () => {
      clearTimeout(timeoutId)
    }
  }
}

