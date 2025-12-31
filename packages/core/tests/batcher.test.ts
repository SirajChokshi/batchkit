import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { createBatcher, BatchError } from '../src'
import type { BatchInfo, BatchErrorInfo } from '../src'

describe('createBatcher', () => {
  describe('basic functionality', () => {
    it('should batch multiple calls into a single resolver call', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `result-${k}`)
      })

      const batcher = createBatcher({ resolver })

      // Make multiple calls in the same tick
      const results = await Promise.all([
        batcher.load('a'),
        batcher.load('b'),
        batcher.load('c'),
      ])

      expect(results).toEqual(['result-a', 'result-b', 'result-c'])
      expect(resolver).toHaveBeenCalledTimes(1)
      expect(resolver).toHaveBeenCalledWith(['a', 'b', 'c'])
    })

    it('should return correct results for each key', async () => {
      const batcher = createBatcher({
        resolver: async (keys: number[]) => {
          return keys.map((k) => k * 2)
        },
      })

      const [a, b, c] = await Promise.all([
        batcher.load(1),
        batcher.load(2),
        batcher.load(3),
      ])

      expect(a).toBe(2)
      expect(b).toBe(4)
      expect(c).toBe(6)
    })

    it('should handle a single load call', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `result-${k}`)
      })

      const batcher = createBatcher({ resolver })
      const result = await batcher.load('single')

      expect(result).toBe('result-single')
      expect(resolver).toHaveBeenCalledWith(['single'])
    })
  })

  describe('loadMany', () => {
    it('should load multiple keys in one call', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => k.toUpperCase())
      })

      const batcher = createBatcher({ resolver })
      const results = await batcher.loadMany(['foo', 'bar', 'baz'])

      expect(results).toEqual(['FOO', 'BAR', 'BAZ'])
      expect(resolver).toHaveBeenCalledTimes(1)
    })

    it('should batch loadMany with load calls', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => k.toUpperCase())
      })

      const batcher = createBatcher({ resolver })

      const [single, many] = await Promise.all([
        batcher.load('one'),
        batcher.loadMany(['two', 'three']),
      ])

      expect(single).toBe('ONE')
      expect(many).toEqual(['TWO', 'THREE'])
      expect(resolver).toHaveBeenCalledTimes(1)
      expect(resolver).toHaveBeenCalledWith(['one', 'two', 'three'])
    })
  })

  describe('deduplication', () => {
    it('should deduplicate identical keys in the same batch', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `result-${k}`)
      })

      const batcher = createBatcher({ resolver })

      const results = await Promise.all([
        batcher.load('same'),
        batcher.load('same'),
        batcher.load('same'),
        batcher.load('different'),
      ])

      expect(results).toEqual([
        'result-same',
        'result-same',
        'result-same',
        'result-different',
      ])
      expect(resolver).toHaveBeenCalledTimes(1)
      expect(resolver).toHaveBeenCalledWith(['same', 'different'])
    })

    it('should use custom keyFn for deduplication', async () => {
      const resolver = mock(async (keys: { id: number }[]) => {
        return keys.map((k) => ({ ...k, fetched: true }))
      })

      const batcher = createBatcher({
        resolver,
        keyFn: (k) => k.id,
      })

      const results = await Promise.all([
        batcher.load({ id: 1 }),
        batcher.load({ id: 1 }), // Same id, should be deduped
        batcher.load({ id: 2 }),
      ])

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ id: 1, fetched: true })
      expect(results[1]).toEqual({ id: 1, fetched: true })
      expect(results[2]).toEqual({ id: 2, fetched: true })
      expect(resolver).toHaveBeenCalledTimes(1)
    })
  })

  describe('caching (prime/clear)', () => {
    it('should return primed values without calling resolver', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `fetched-${k}`)
      })

      const batcher = createBatcher({ resolver })

      // Prime the cache
      batcher.prime('cached', 'primed-value')

      const result = await batcher.load('cached')

      expect(result).toBe('primed-value')
      expect(resolver).not.toHaveBeenCalled()
    })

    it('should clear specific keys from cache', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `fetched-${k}`)
      })

      const batcher = createBatcher({ resolver })

      batcher.prime('key1', 'cached-1')
      batcher.prime('key2', 'cached-2')

      batcher.clear('key1')

      const [result1, result2] = await Promise.all([
        batcher.load('key1'),
        batcher.load('key2'),
      ])

      expect(result1).toBe('fetched-key1') // Fetched because cleared
      expect(result2).toBe('cached-2') // Still cached
      expect(resolver).toHaveBeenCalledWith(['key1'])
    })

    it('should clear all cached values', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `fetched-${k}`)
      })

      const batcher = createBatcher({ resolver })

      batcher.prime('key1', 'cached-1')
      batcher.prime('key2', 'cached-2')

      batcher.clearAll()

      const results = await Promise.all([
        batcher.load('key1'),
        batcher.load('key2'),
      ])

      expect(results).toEqual(['fetched-key1', 'fetched-key2'])
      expect(resolver).toHaveBeenCalledWith(['key1', 'key2'])
    })
  })

  describe('maxBatchSize', () => {
    it('should split large batches into chunks', async () => {
      const resolver = mock(async (keys: number[]) => {
        return keys.map((k) => k * 10)
      })

      const batcher = createBatcher({
        resolver,
        maxBatchSize: 2,
      })

      const results = await Promise.all([
        batcher.load(1),
        batcher.load(2),
        batcher.load(3),
        batcher.load(4),
        batcher.load(5),
      ])

      expect(results).toEqual([10, 20, 30, 40, 50])
      // Should be called 3 times: [1,2], [3,4], [5]
      expect(resolver).toHaveBeenCalledTimes(3)
    })
  })

  describe('error handling', () => {
    it('should reject all requests when resolver throws', async () => {
      const batcher = createBatcher({
        resolver: async () => {
          throw new Error('Database error')
        },
      })

      const results = await Promise.allSettled([
        batcher.load('a'),
        batcher.load('b'),
      ])

      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('rejected')
      expect((results[0] as PromiseRejectedResult).reason.message).toBe(
        'Database error'
      )
    })

    it('should handle per-item errors when resolver returns Error instances', async () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => {
          return keys.map((k) =>
            k === 'bad' ? new Error('Not found') : `result-${k}`
          )
        },
      })

      const results = await Promise.allSettled([
        batcher.load('good'),
        batcher.load('bad'),
        batcher.load('also-good'),
      ])

      expect(results[0].status).toBe('fulfilled')
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe(
        'result-good'
      )

      expect(results[1].status).toBe('rejected')
      expect((results[1] as PromiseRejectedResult).reason.message).toBe(
        'Not found'
      )

      expect(results[2].status).toBe('fulfilled')
      expect((results[2] as PromiseFulfilledResult<string>).value).toBe(
        'result-also-good'
      )
    })

    it('should throw BatchError when resolver returns wrong number of results', async () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => {
          // Return fewer results than keys
          return keys.slice(0, 1)
        },
      })

      const results = await Promise.allSettled([
        batcher.load('a'),
        batcher.load('b'),
        batcher.load('c'),
      ])

      expect(results[0].status).toBe('rejected')
      const error = (results[0] as PromiseRejectedResult).reason
      expect(error).toBeInstanceOf(BatchError)
      expect(error.message).toContain('1 results for 3 keys')
    })
  })

  describe('manual scheduler', () => {
    it('should only dispatch when .dispatch() is called', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `result-${k}`)
      })

      const batcher = createBatcher({
        resolver,
        scheduler: 'manual',
      })

      // Queue up some requests
      const promises = [batcher.load('a'), batcher.load('b')]

      // Resolver should not be called yet
      expect(resolver).not.toHaveBeenCalled()

      // Manually dispatch
      await batcher.dispatch()

      const results = await Promise.all(promises)
      expect(results).toEqual(['result-a', 'result-b'])
      expect(resolver).toHaveBeenCalledTimes(1)
    })

    it('should do nothing when dispatch is called with empty queue', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `result-${k}`)
      })

      const batcher = createBatcher({
        resolver,
        scheduler: 'manual',
      })

      await batcher.dispatch()
      expect(resolver).not.toHaveBeenCalled()
    })
  })

  describe('name property', () => {
    it('should expose the batcher name', () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        name: 'my-batcher',
      })

      expect(batcher.name).toBe('my-batcher')
    })

    it('should be undefined when not provided', () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
      })

      expect(batcher.name).toBeUndefined()
    })
  })

  describe('separate batches across ticks', () => {
    it('should create separate batches for calls in different ticks', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => `result-${k}`)
      })

      const batcher = createBatcher({ resolver })

      // First tick
      const result1 = await batcher.load('first')

      // Second tick
      const result2 = await batcher.load('second')

      expect(result1).toBe('result-first')
      expect(result2).toBe('result-second')
      expect(resolver).toHaveBeenCalledTimes(2)
      expect(resolver).toHaveBeenNthCalledWith(1, ['first'])
      expect(resolver).toHaveBeenNthCalledWith(2, ['second'])
    })
  })
})

describe('observability hooks', () => {
  describe('onBatch', () => {
    it('should call onBatch after successful batch execution', async () => {
      const onBatch = mock((_info: BatchInfo<string, string>) => {})

      const batcher = createBatcher({
        resolver: async (keys: string[]) => {
          return keys.map((k) => k.toUpperCase())
        },
        name: 'test-batcher',
        onBatch,
      })

      await Promise.all([batcher.load('a'), batcher.load('b')])

      expect(onBatch).toHaveBeenCalledTimes(1)

      const info = onBatch.mock.calls[0][0]
      expect(info.name).toBe('test-batcher')
      expect(info.keys).toEqual(['a', 'b'])
      expect(info.size).toBe(2)
      expect(info.results).toEqual(['A', 'B'])
      expect(typeof info.duration).toBe('number')
      expect(info.duration).toBeGreaterThanOrEqual(0)
      expect(typeof info.startedAt).toBe('number')
      expect(typeof info.completedAt).toBe('number')
    })

    it('should not be called when batch fails', async () => {
      const onBatch = mock(() => {})

      const batcher = createBatcher({
        resolver: async () => {
          throw new Error('fail')
        },
        onBatch,
      })

      await Promise.allSettled([batcher.load('a')])

      expect(onBatch).not.toHaveBeenCalled()
    })
  })

  describe('onError', () => {
    it('should call onError when batch fails', async () => {
      const onError = mock((_info: BatchErrorInfo<string>) => {})

      const batcher = createBatcher({
        resolver: async () => {
          throw new Error('Database connection failed')
        },
        name: 'error-batcher',
        onError,
      })

      await Promise.allSettled([batcher.load('a'), batcher.load('b')])

      expect(onError).toHaveBeenCalledTimes(1)

      const info = onError.mock.calls[0][0]
      expect(info.name).toBe('error-batcher')
      expect(info.keys).toEqual(['a', 'b'])
      expect(info.error.message).toBe('Database connection failed')
      expect(typeof info.timestamp).toBe('number')
    })

    it('should not be called on success', async () => {
      const onError = mock(() => {})

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        onError,
      })

      await batcher.load('a')

      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('hook error handling', () => {
    it('should not throw when onBatch throws', async () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        onBatch: () => {
          throw new Error('Hook error')
        },
      })

      // Should not throw
      const result = await batcher.load('a')
      expect(result).toBe('a')
    })

    it('should not throw when onError throws', async () => {
      const batcher = createBatcher({
        resolver: async () => {
          throw new Error('Resolver error')
        },
        onError: () => {
          throw new Error('Hook error')
        },
      })

      // Should reject with resolver error, not hook error
      const result = await Promise.allSettled([batcher.load('a')])
      expect(result[0].status).toBe('rejected')
      expect((result[0] as PromiseRejectedResult).reason.message).toBe(
        'Resolver error'
      )
    })
  })
})

