import { describe, expect, it, mock } from 'bun:test';
import { batch, onAnimationFrame, onIdle } from '../src';

describe('schedulers', () => {
  describe('default microtask scheduler', () => {
    it('should batch calls within the same microtask', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');

      // All these happen in the same synchronous block
      const promises = [items.get('a'), items.get('b'), items.get('c')];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('wait option', () => {
    it('should delay dispatch by specified milliseconds', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { wait: 20 });

      const promise1 = items.get('a');

      // Wait less than the delay
      await new Promise((r) => setTimeout(r, 5));

      // Add another request
      const promise2 = items.get('b');

      // Still not called
      expect(fn).not.toHaveBeenCalled();

      const results = await Promise.all([promise1, promise2]);

      expect(results).toEqual([{ id: 'a' }, { id: 'b' }]);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom scheduler', () => {
    it('should use custom scheduler function', async () => {
      const dispatches: (() => void)[] = [];

      const customScheduler = (dispatch: () => void) => {
        dispatches.push(dispatch);
        return () => {};
      };

      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { schedule: customScheduler });

      const promise = items.get('a');

      // Not dispatched yet
      expect(fn).not.toHaveBeenCalled();
      expect(dispatches).toHaveLength(1);

      // Manually dispatch
      dispatches[0]();

      const result = await promise;
      expect(result).toEqual({ id: 'a' });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('onIdle scheduler', () => {
    it('should batch with idle scheduler', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { schedule: onIdle({ timeout: 10 }) });

      const result = await items.get('a');

      expect(result).toEqual({ id: 'a' });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should batch with idle scheduler without options', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { schedule: onIdle() });

      const result = await items.get('a');

      expect(result).toEqual({ id: 'a' });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('onAnimationFrame scheduler', () => {
    it('should batch with animation frame scheduler', async () => {
      // polyfill requestAnimationFrame for node/bun environment
      const originalRAF = globalThis.requestAnimationFrame;
      const originalCAF = globalThis.cancelAnimationFrame;
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number;
      globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);

      try {
        const fn = mock(async (keys: string[]) => {
          return keys.map((k) => ({ id: k }));
        });

        const items = batch(fn, 'id', { schedule: onAnimationFrame });

        const result = await items.get('a');

        expect(result).toEqual({ id: 'a' });
        expect(fn).toHaveBeenCalledTimes(1);
      } finally {
        if (originalRAF) globalThis.requestAnimationFrame = originalRAF;
        else delete (globalThis as Record<string, unknown>).requestAnimationFrame;
        if (originalCAF) globalThis.cancelAnimationFrame = originalCAF;
        else delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
      }
    });
  });

  describe('scheduler cleanup', () => {
    it('should call cleanup when abort is called before dispatch', async () => {
      let cleanupCalled = false;

      const customScheduler = (dispatch: () => void) => {
        setTimeout(dispatch, 1000);
        return () => {
          cleanupCalled = true;
        };
      };

      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { schedule: customScheduler });

      const promise = items.get('a');

      items.abort();

      await promise.catch(() => {});

      expect(cleanupCalled).toBe(true);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should call cleanup when flush is called', async () => {
      let cleanupCalled = false;

      const customScheduler = (dispatch: () => void) => {
        setTimeout(dispatch, 1000);
        return () => {
          cleanupCalled = true;
        };
      };

      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { schedule: customScheduler });

      const promise = items.get('a');

      await items.flush();

      expect(cleanupCalled).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);
      await promise;
    });
  });
});
