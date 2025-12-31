import { describe, it, expect, mock } from 'bun:test'
import { createBatcher, windowScheduler } from '../src'
import type { BatchInfo } from '../src'

describe('integration tests', () => {
  describe('database-like scenarios', () => {
    it('should efficiently batch user lookups', async () => {
      // Simulate a database
      const db = new Map([
        ['user-1', { id: 'user-1', name: 'Alice' }],
        ['user-2', { id: 'user-2', name: 'Bob' }],
        ['user-3', { id: 'user-3', name: 'Charlie' }],
      ])

      const queryCount = { value: 0 }

      const userLoader = createBatcher({
        name: 'users',
        resolver: async (ids: string[]) => {
          queryCount.value++
          // Simulate SQL: SELECT * FROM users WHERE id IN (...)
          return ids.map((id) => db.get(id) ?? null)
        },
      })

      // Simulate multiple components requesting user data
      const [user1, user2, user3, user1Again] = await Promise.all([
        userLoader.load('user-1'),
        userLoader.load('user-2'),
        userLoader.load('user-3'),
        userLoader.load('user-1'), // Duplicate - should be deduped
      ])

      expect(user1).toEqual({ id: 'user-1', name: 'Alice' })
      expect(user2).toEqual({ id: 'user-2', name: 'Bob' })
      expect(user3).toEqual({ id: 'user-3', name: 'Charlie' })
      expect(user1Again).toEqual({ id: 'user-1', name: 'Alice' })

      // Only one query should have been made
      expect(queryCount.value).toBe(1)
    })

    it('should handle missing records gracefully', async () => {
      const db = new Map([['exists', { id: 'exists', data: 'found' }]])

      const loader = createBatcher({
        resolver: async (ids: string[]) => {
          return ids.map((id) => db.get(id) ?? null)
        },
      })

      const [found, notFound] = await Promise.all([
        loader.load('exists'),
        loader.load('missing'),
      ])

      expect(found).toEqual({ id: 'exists', data: 'found' })
      expect(notFound).toBeNull()
    })
  })

  describe('API batching scenarios', () => {
    it('should batch API requests', async () => {
      // Simulate an API that supports batch fetching
      const apiCalls = { value: 0 }

      const productLoader = createBatcher({
        resolver: async (productIds: number[]) => {
          apiCalls.value++
          // Simulate: POST /api/products/batch { ids: [...] }
          return productIds.map((id) => ({
            id,
            name: `Product ${id}`,
            price: id * 10,
          }))
        },
      })

      // Simulate a product list page loading 20 products
      const productPromises = Array.from({ length: 20 }, (_, i) =>
        productLoader.load(i + 1)
      )

      const products = await Promise.all(productPromises)

      expect(products).toHaveLength(20)
      expect(products[0]).toEqual({ id: 1, name: 'Product 1', price: 10 })
      expect(products[19]).toEqual({ id: 20, name: 'Product 20', price: 200 })

      // Only one API call
      expect(apiCalls.value).toBe(1)
    })

    it('should respect rate limits with maxBatchSize', async () => {
      const apiCalls: number[][] = []

      const loader = createBatcher({
        resolver: async (ids: number[]) => {
          apiCalls.push([...ids])
          return ids.map((id) => `result-${id}`)
        },
        maxBatchSize: 5, // API limit of 5 items per request
      })

      // Request 12 items
      const promises = Array.from({ length: 12 }, (_, i) => loader.load(i))
      await Promise.all(promises)

      // Should be split into 3 calls: [0-4], [5-9], [10-11]
      expect(apiCalls).toHaveLength(3)
      expect(apiCalls[0]).toEqual([0, 1, 2, 3, 4])
      expect(apiCalls[1]).toEqual([5, 6, 7, 8, 9])
      expect(apiCalls[2]).toEqual([10, 11])
    })
  })

  describe('observability scenarios', () => {
    it('should track batch metrics for performance monitoring', async () => {
      const metrics: BatchInfo<string, string>[] = []

      const loader = createBatcher({
        resolver: async (keys: string[]) => {
          // Simulate some processing time
          await new Promise((r) => setTimeout(r, 10))
          return keys.map((k) => k.toUpperCase())
        },
        name: 'metrics-test',
        onBatch: (info) => {
          metrics.push(info)
        },
      })

      await Promise.all([loader.load('a'), loader.load('b'), loader.load('c')])

      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('metrics-test')
      expect(metrics[0].size).toBe(3)
      expect(metrics[0].duration).toBeGreaterThan(0)
      expect(metrics[0].keys).toEqual(['a', 'b', 'c'])
      expect(metrics[0].results).toEqual(['A', 'B', 'C'])
    })

    it('should report errors for debugging', async () => {
      const errors: Array<{ name?: string; keys: string[]; message: string }> = []

      const loader = createBatcher<string, never>({
        resolver: async () => {
          throw new Error('Connection timeout')
        },
        name: 'error-tracker',
        onError: (info) => {
          errors.push({
            name: info.name,
            keys: info.keys,
            message: info.error.message,
          })
        },
      })

      await Promise.allSettled([loader.load('x'), loader.load('y')])

      expect(errors).toHaveLength(1)
      expect(errors[0].name).toBe('error-tracker')
      expect(errors[0].keys).toEqual(['x', 'y'])
      expect(errors[0].message).toBe('Connection timeout')
    })
  })

  describe('caching scenarios', () => {
    it('should use primed cache for immediate responses', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => ({ id: k, fresh: true }))
      })

      const loader = createBatcher({ resolver })

      // Prime cache with stale data
      loader.prime('cached-1', { id: 'cached-1', fresh: false })
      loader.prime('cached-2', { id: 'cached-2', fresh: false })

      const [cached1, cached2, fresh] = await Promise.all([
        loader.load('cached-1'),
        loader.load('cached-2'),
        loader.load('fresh-1'),
      ])

      // Cached items return immediately without fetch
      expect(cached1).toEqual({ id: 'cached-1', fresh: false })
      expect(cached2).toEqual({ id: 'cached-2', fresh: false })
      expect(fresh).toEqual({ id: 'fresh-1', fresh: true })

      // Only fresh-1 was fetched
      expect(resolver).toHaveBeenCalledWith(['fresh-1'])
    })

    it('should support cache invalidation', async () => {
      let fetchCount = 0

      const loader = createBatcher({
        resolver: async (keys: string[]) => {
          fetchCount++
          return keys.map((k) => `fetch-${fetchCount}-${k}`)
        },
      })

      // First fetch
      const result1 = await loader.load('key')
      expect(result1).toBe('fetch-1-key')

      // Prime with updated value
      loader.prime('key', 'updated-value')

      // Should return primed value
      const result2 = await loader.load('key')
      expect(result2).toBe('updated-value')

      // Clear and refetch
      loader.clear('key')
      const result3 = await loader.load('key')
      expect(result3).toBe('fetch-2-key')
    })
  })

  describe('complex object keys', () => {
    it('should handle object keys with custom keyFn', async () => {
      interface QueryKey {
        table: string
        id: number
      }

      const loader = createBatcher({
        resolver: async (keys: QueryKey[]) => {
          return keys.map((k) => ({ ...k, data: `${k.table}:${k.id}` }))
        },
        keyFn: (k) => `${k.table}:${k.id}`,
      })

      const [a, b, aDuplicate] = await Promise.all([
        loader.load({ table: 'users', id: 1 }),
        loader.load({ table: 'posts', id: 1 }),
        loader.load({ table: 'users', id: 1 }), // Same as first
      ])

      expect(a).toEqual({ table: 'users', id: 1, data: 'users:1' })
      expect(b).toEqual({ table: 'posts', id: 1, data: 'posts:1' })
      expect(aDuplicate).toEqual(a)
    })
  })

  describe('concurrent batches', () => {
    it('should handle rapid sequential batches', async () => {
      const batches: string[][] = []

      const loader = createBatcher({
        resolver: async (keys: string[]) => {
          batches.push([...keys])
          return keys.map((k) => k.toUpperCase())
        },
      })

      // Multiple sequential batches
      for (let i = 0; i < 5; i++) {
        await loader.load(`batch-${i}`)
      }

      // Each await creates a new batch
      expect(batches).toHaveLength(5)
      batches.forEach((batch, i) => {
        expect(batch).toEqual([`batch-${i}`])
      })
    })

    it('should handle mixed sync and async patterns', async () => {
      const resolver = mock(async (keys: string[]) => {
        return keys.map((k) => k.toUpperCase())
      })

      const loader = createBatcher({ resolver })

      // Sync batch
      const syncPromises = [
        loader.load('sync-1'),
        loader.load('sync-2'),
        loader.load('sync-3'),
      ]

      // Wait for sync batch
      await Promise.all(syncPromises)

      // Another sync batch
      const morePromises = [loader.load('more-1'), loader.load('more-2')]

      await Promise.all(morePromises)

      expect(resolver).toHaveBeenCalledTimes(2)
      expect(resolver).toHaveBeenNthCalledWith(1, ['sync-1', 'sync-2', 'sync-3'])
      expect(resolver).toHaveBeenNthCalledWith(2, ['more-1', 'more-2'])
    })
  })

  describe('stress tests', () => {
    it('should handle large batches efficiently', async () => {
      const loader = createBatcher({
        resolver: async (keys: number[]) => {
          return keys.map((k) => k * 2)
        },
      })

      // 1000 concurrent requests
      const promises = Array.from({ length: 1000 }, (_, i) => loader.load(i))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(1000)
      expect(results[0]).toBe(0)
      expect(results[999]).toBe(1998)
    })

    it('should handle many small batches', async () => {
      const batchCount = { value: 0 }

      const loader = createBatcher({
        resolver: async (keys: number[]) => {
          batchCount.value++
          return keys.map((k) => k)
        },
      })

      // 100 sequential single-item batches
      for (let i = 0; i < 100; i++) {
        await loader.load(i)
      }

      expect(batchCount.value).toBe(100)
    })
  })
})

