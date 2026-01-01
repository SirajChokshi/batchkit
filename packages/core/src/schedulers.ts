import type { Scheduler } from './types';

export const microtask: Scheduler = (dispatch) => {
  let cancelled = false;

  queueMicrotask(() => {
    if (!cancelled) {
      dispatch();
    }
  });

  return () => {
    cancelled = true;
  };
};

export function wait(ms: number): Scheduler {
  return (dispatch) => {
    const id = setTimeout(dispatch, ms);
    return () => clearTimeout(id);
  };
}

export const onAnimationFrame: Scheduler = (dispatch) => {
  const id = requestAnimationFrame(dispatch);
  return () => cancelAnimationFrame(id);
};

export function onIdle(options?: { timeout?: number }): Scheduler {
  return (dispatch) => {
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(
        dispatch,
        options?.timeout ? { timeout: options.timeout } : undefined,
      );
      return () => cancelIdleCallback(id);
    }

    const id = setTimeout(dispatch, options?.timeout ?? 1);
    return () => clearTimeout(id);
  };
}
