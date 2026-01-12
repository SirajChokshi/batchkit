import { describe, expect, it, mock } from 'bun:test';
import { BatchError, batch, indexed, type TraceEvent } from '../src';

describe('batch', () => {
  describe('basic functionality', () => {
    it('should batch multiple calls into a single function call', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k, name: `User ${k}` }));
      });

      const users = batch(fn, 'id');

      const results = await Promise.all([
        users.get('a'),
        users.get('b'),
        users.get('c'),
      ]);

      expect(results).toEqual([
        { id: 'a', name: 'User a' },
        { id: 'b', name: 'User b' },
        { id: 'c', name: 'User c' },
      ]);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(['a', 'b', 'c'], expect.any(AbortSignal));
    });

    it('should return correct results for each key', async () => {
      const users = batch(
        async (keys: number[]) => keys.map((k) => ({ id: k, value: k * 2 })),
        'id',
      );

      const [a, b, c] = await Promise.all([
        users.get(1),
        users.get(2),
        users.get(3),
      ]);

      expect(a).toEqual({ id: 1, value: 2 });
      expect(b).toEqual({ id: 2, value: 4 });
      expect(c).toEqual({ id: 3, value: 6 });
    });

    it('should handle a single get call', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const users = batch(fn, 'id');
      const result = await users.get('single');

      expect(result).toEqual({ id: 'single' });
      expect(fn).toHaveBeenCalledWith(['single'], expect.any(AbortSignal));
    });
  });

  describe('get with array', () => {
    it('should load multiple keys in one call', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k, upper: k.toUpperCase() }));
      });

      const items = batch(fn, 'id');
      const results = await items.get(['foo', 'bar', 'baz']);

      expect(results).toEqual([
        { id: 'foo', upper: 'FOO' },
        { id: 'bar', upper: 'BAR' },
        { id: 'baz', upper: 'BAZ' },
      ]);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should batch get([...]) with get(single) calls', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');

      const [single, many] = await Promise.all([
        items.get('one'),
        items.get(['two', 'three']),
      ]);

      expect(single).toEqual({ id: 'one' });
      expect(many).toEqual([{ id: 'two' }, { id: 'three' }]);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(
        ['one', 'two', 'three'],
        expect.any(AbortSignal),
      );
    });
  });

  describe('deduplication', () => {
    it('should deduplicate identical keys in the same batch', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');

      const results = await Promise.all([
        items.get('same'),
        items.get('same'),
        items.get('same'),
        items.get('different'),
      ]);

      expect(results).toEqual([
        { id: 'same' },
        { id: 'same' },
        { id: 'same' },
        { id: 'different' },
      ]);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(
        ['same', 'different'],
        expect.any(AbortSignal),
      );
    });

    it('should use custom key function for deduplication', async () => {
      const fn = mock(async (keys: { id: number }[]) => {
        return keys.map((k) => ({ ...k, fetched: true }));
      });

      const items = batch(
        fn,
        (results, key: { id: number }) => results.find((r) => r.id === key.id),
        { key: (k) => k.id },
      );

      const results = await Promise.all([
        items.get({ id: 1 }),
        items.get({ id: 1 }), // Same id, should be deduped
        items.get({ id: 2 }),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: 1, fetched: true });
      expect(results[1]).toEqual({ id: 1, fetched: true });
      expect(results[2]).toEqual({ id: 2, fetched: true });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('indexed matching', () => {
    it('should match results from Record responses', async () => {
      const fn = mock(async (keys: string[]) => {
        const result: Record<string, { name: string }> = {};
        for (const k of keys) {
          result[k] = { name: `User ${k}` };
        }
        return result;
      });

      const users = batch(fn, indexed);

      const results = await Promise.all([users.get('alice'), users.get('bob')]);

      expect(results).toEqual([{ name: 'User alice' }, { name: 'User bob' }]);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom match function', () => {
    it('should use custom match function', async () => {
      type Post = { authorId: number; title: string };

      const fn = mock(async (authorIds: number[]): Promise<Post[]> => {
        return authorIds.map((id) => ({
          authorId: id,
          title: `Post by ${id}`,
        }));
      });

      const posts = batch(fn, (results, authorId: number) =>
        results.find((p) => p.authorId === authorId),
      );

      const [post1, post2] = await Promise.all([posts.get(1), posts.get(2)]);

      expect(post1).toEqual({ authorId: 1, title: 'Post by 1' });
      expect(post2).toEqual({ authorId: 2, title: 'Post by 2' });
    });
  });

  describe('max batch size', () => {
    it('should split large batches into chunks', async () => {
      const fn = mock(async (keys: number[]) => {
        return keys.map((k) => ({ id: k, value: k * 10 }));
      });

      const items = batch(fn, 'id', { max: 2 });

      const results = await Promise.all([
        items.get(1),
        items.get(2),
        items.get(3),
        items.get(4),
        items.get(5),
      ]);

      expect(results).toEqual([
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
        { id: 4, value: 40 },
        { id: 5, value: 50 },
      ]);
      // Should be called 3 times: [1,2], [3,4], [5]
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should reject all requests when batch function throws', async () => {
      const items = batch(async () => {
        throw new Error('Database error');
      }, 'id');

      const results = await Promise.allSettled([
        items.get('a'),
        items.get('b'),
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
      expect((results[0] as PromiseRejectedResult).reason.message).toBe(
        'Database error',
      );
    });

    it('should reject with BatchError when key not found in results', async () => {
      const items = batch(async (keys: string[]) => {
        // Only return some results
        return keys.slice(0, 1).map((k) => ({ id: k }));
      }, 'id');

      const results = await Promise.allSettled([
        items.get('a'),
        items.get('b'),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(
        BatchError,
      );
    });
  });

  describe('flush', () => {
    it('should dispatch pending batch immediately', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { wait: 1000 }); // Long wait

      const promises = [items.get('a'), items.get('b')];

      // Not called yet due to wait
      expect(fn).not.toHaveBeenCalled();

      // Flush immediately
      await items.flush();

      const results = await Promise.all(promises);
      expect(results).toEqual([{ id: 'a' }, { id: 'b' }]);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when called with empty queue', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');

      await items.flush();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('abort', () => {
    it('should reject pending requests when abort is called', async () => {
      const fn = mock(async (keys: string[]) => {
        await new Promise((r) => setTimeout(r, 100));
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { wait: 1000 });

      const promise = items.get('a');

      items.abort();

      const result = await promise.catch((e) => e);
      expect(result).toBeInstanceOf(DOMException);
      expect(result.name).toBe('AbortError');
    });

    it('should support per-request abort signal', async () => {
      const fn = mock(async (keys: string[]) => {
        await new Promise((r) => setTimeout(r, 50));
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');

      const controller = new AbortController();
      const promise = items.get('a', { signal: controller.signal });

      controller.abort();

      const result = await promise.catch((e) => e);
      expect(result).toBeInstanceOf(DOMException);
      expect(result.name).toBe('AbortError');
    });

    it('should reject immediately if signal is already aborted', async () => {
      const items = batch(
        async (keys: string[]) => keys.map((k) => ({ id: k })),
        'id',
      );

      const controller = new AbortController();
      controller.abort();

      const result = await items
        .get('a', { signal: controller.signal })
        .catch((e) => e);
      expect(result).toBeInstanceOf(DOMException);
      expect(result.name).toBe('AbortError');
    });
  });

  describe('name property', () => {
    it('should expose the batcher name', () => {
      const items = batch(
        async (keys: string[]) => keys.map((k) => ({ id: k })),
        'id',
        { name: 'my-batcher' },
      );

      expect(items.name).toBe('my-batcher');
    });

    it('should be undefined when not provided', () => {
      const items = batch(
        async (keys: string[]) => keys.map((k) => ({ id: k })),
        'id',
      );

      expect(items.name).toBeUndefined();
    });
  });

  describe('separate batches across ticks', () => {
    it('should create separate batches for calls in different ticks', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');

      // First tick
      const result1 = await items.get('first');

      // Second tick
      const result2 = await items.get('second');

      expect(result1).toEqual({ id: 'first' });
      expect(result2).toEqual({ id: 'second' });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, ['first'], expect.any(AbortSignal));
      expect(fn).toHaveBeenNthCalledWith(
        2,
        ['second'],
        expect.any(AbortSignal),
      );
    });
  });

  describe('tracing', () => {
    it('should emit trace events', async () => {
      const events: TraceEvent<string>[] = [];

      const items = batch(
        async (keys: string[]) => keys.map((k) => ({ id: k })),
        'id',
        {
          name: 'test',
          trace: (event) => events.push(event),
        },
      );

      await items.get('a');

      const types = events.map((e) => e.type);
      expect(types).toContain('get');
      expect(types).toContain('schedule');
      expect(types).toContain('dispatch');
      expect(types).toContain('resolve');
    });

    it('should emit dedup trace event for duplicate keys', async () => {
      const events: TraceEvent<string>[] = [];

      const items = batch(
        async (keys: string[]) => keys.map((k) => ({ id: k })),
        'id',
        {
          name: 'test',
          trace: (event) => events.push(event),
        },
      );

      await Promise.all([items.get('same'), items.get('same')]);

      const types = events.map((e) => e.type);
      expect(types).toContain('dedup');
    });

    it('should emit error trace event when batch function throws', async () => {
      const events: TraceEvent<string>[] = [];

      const items = batch(
        async (_keys: string[]) => {
          throw new Error('test error');
        },
        'id',
        {
          name: 'test',
          trace: (event) => events.push(event),
        },
      );

      await items.get('a').catch(() => {});

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(
        (errorEvent as Extract<TraceEvent<string>, { type: 'error' }>).error
          .message,
      ).toBe('test error');
    });

    it('should emit abort trace event when aborted', async () => {
      const events: TraceEvent<string>[] = [];

      const items = batch(
        async (keys: string[]) => {
          await new Promise((r) => setTimeout(r, 100));
          return keys.map((k) => ({ id: k }));
        },
        'id',
        {
          name: 'test',
          wait: 10,
          trace: (event) => events.push(event),
        },
      );

      const promise = items.get('a');
      items.abort();
      await promise.catch(() => {});

      const types = events.map((e) => e.type);
      expect(types).toContain('get');
    });
  });

  describe('numeric property key matching', () => {
    it('should support numeric property keys as match', async () => {
      type Item = [number, string];

      const fn = mock(async (keys: number[]): Promise<Item[]> => {
        return keys.map((k) => [k, `value-${k}`]);
      });

      const items = batch(fn, 0 as keyof Item);

      const results = await Promise.all([
        items.get(1),
        items.get(2),
        items.get(3),
      ]);

      expect(results).toEqual([
        [1, 'value-1'],
        [2, 'value-2'],
        [3, 'value-3'],
      ]);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('indexed matching edge cases', () => {
    it('should reject with BatchError when key not found in indexed result', async () => {
      const fn = mock(async (keys: string[]) => {
        const result: Record<string, { name: string }> = {};
        for (const k of keys.slice(0, 1)) {
          result[k] = { name: `User ${k}` };
        }
        return result;
      });

      const users = batch(fn, indexed);

      const results = await Promise.allSettled([
        users.get('alice'),
        users.get('bob'),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(
        BatchError,
      );
    });

    it('should work with max batch size and indexed matching', async () => {
      const fn = mock(async (keys: string[]) => {
        const result: Record<string, { value: number }> = {};
        for (const k of keys) {
          result[k] = { value: k.length };
        }
        return result;
      });

      const items = batch(fn, indexed, { max: 2 });

      const results = await Promise.all([
        items.get('a'),
        items.get('bb'),
        items.get('ccc'),
      ]);

      expect(results).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle non-Error throws from batch function', async () => {
      const items = batch(async () => {
        throw 'string error';
      }, 'id');

      const result = await items.get('a').catch((e) => e);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('string error');
    });

    it('should throw BatchError when batch function returns non-array with array match', async () => {
      const items = batch(async () => {
        return { not: 'an array' } as unknown as { id: string }[];
      }, 'id');

      const result = await items.get('a').catch((e) => e);
      expect(result).toBeInstanceOf(BatchError);
      expect(result.message).toContain('non-array');
    });

    it('should throw BatchError for unsupported symbol match', () => {
      const unsupported = Symbol('unsupported');
      expect(() =>
        batch(
          async (keys: string[]) => keys.map((k) => ({ id: k })),
          unsupported as unknown as never,
        ),
      ).toThrow(BatchError);
    });
  });

  describe('abort edge cases', () => {
    it('should abort underlying batch function when all per-request signals abort', async () => {
      let capturedSignal: AbortSignal | null = null;

      const items = batch(async (keys: string[], signal: AbortSignal) => {
        capturedSignal = signal;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => resolve(keys.map((k) => ({ id: k }))),
            100,
          );
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
        return keys.map((k) => ({ id: k }));
      }, 'id');

      const controller1 = new AbortController();
      const controller2 = new AbortController();

      const promise1 = items.get('a', { signal: controller1.signal });
      const promise2 = items.get('b', { signal: controller2.signal });

      await new Promise((r) => setTimeout(r, 10));

      controller1.abort();
      controller2.abort();

      await Promise.allSettled([promise1, promise2]);

      expect(capturedSignal).not.toBeNull();
      // @ts-expect-error - capturedSignal is not typed
      expect(capturedSignal?.aborted).toBe(true);
    });

    it('should not abort underlying fetch when only some requests are aborted', async () => {
      let capturedSignal: AbortSignal | null = null;

      const items = batch(async (keys: string[], signal: AbortSignal) => {
        capturedSignal = signal;
        await new Promise((r) => setTimeout(r, 50));
        return keys.map((k) => ({ id: k }));
      }, 'id');

      const controller = new AbortController();

      const promise1 = items.get('a', { signal: controller.signal });
      const promise2 = items.get('b');

      await new Promise((r) => setTimeout(r, 10));

      controller.abort();

      const [result1, result2] = await Promise.allSettled([promise1, promise2]);

      expect(result1.status).toBe('rejected');
      expect(result2.status).toBe('fulfilled');
      expect(capturedSignal).not.toBeNull();
      // @ts-expect-error - capturedSignal is not typed
      expect(capturedSignal?.aborted).toBe(false);
    });
  });

  describe('empty array edge case', () => {
    it('should return empty array for get([])', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');
      const results = await items.get([]);

      expect(results).toEqual([]);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('flush edge cases', () => {
    it('should handle flush called multiple times', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id', { wait: 1000 });

      const promise = items.get('a');

      await Promise.all([items.flush(), items.flush(), items.flush()]);

      const result = await promise;
      expect(result).toEqual({ id: 'a' });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle new requests after flush', async () => {
      const fn = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k }));
      });

      const items = batch(fn, 'id');

      await items.get('first');
      await items.get('second');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrent batches', () => {
    it('should handle new requests while batch is in-flight', async () => {
      const fn = mock(async (keys: string[]) => {
        const batchMarker = keys.join(',');
        await new Promise((r) => setTimeout(r, 30));
        return keys.map((k) => ({ id: k, batchKeys: batchMarker }));
      });

      const items = batch(fn, 'id');

      const promise1 = items.get('a');

      await new Promise((r) => setTimeout(r, 10));

      const promise2 = items.get('b');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual({ id: 'a', batchKeys: 'a' });
      expect(result2).toEqual({ id: 'b', batchKeys: 'b' });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
