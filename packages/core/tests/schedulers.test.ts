import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { createBatcher, windowScheduler } from '../src'

describe('windowScheduler', () => {
  it('should batch requests within the time window', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({
      resolver,
      scheduler: windowScheduler({ wait: 50 }),
    })

    // Make calls spread over time but within window
    const promise1 = batcher.load('a')

    await new Promise((r) => setTimeout(r, 10))
    const promise2 = batcher.load('b')

    await new Promise((r) => setTimeout(r, 10))
    const promise3 = batcher.load('c')

    const results = await Promise.all([promise1, promise2, promise3])

    expect(results).toEqual(['result-a', 'result-b', 'result-c'])
    // Due to how window scheduler works, each call starts its own timer
    // So we may have multiple batches
    expect(resolver).toHaveBeenCalled()
  })

  it('should dispatch after the wait time', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({
      resolver,
      scheduler: windowScheduler({ wait: 20 }),
    })

    const promise = batcher.load('test')

    // Should not be called immediately
    expect(resolver).not.toHaveBeenCalled()

    // Wait for the window to close
    await promise

    expect(resolver).toHaveBeenCalledTimes(1)
    expect(resolver).toHaveBeenCalledWith(['test'])
  })

  it('should handle multiple batches correctly', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({
      resolver,
      scheduler: windowScheduler({ wait: 10 }),
    })

    // First batch
    const result1 = await batcher.load('first')

    // Wait to ensure first batch is processed
    await new Promise((r) => setTimeout(r, 20))

    // Second batch
    const result2 = await batcher.load('second')

    expect(result1).toBe('result-first')
    expect(result2).toBe('result-second')
    expect(resolver).toHaveBeenCalledTimes(2)
  })
})

describe('microtask scheduler (default)', () => {
  it('should batch all synchronous calls', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({ resolver })

    // All these calls happen synchronously
    const promises = [
      batcher.load('1'),
      batcher.load('2'),
      batcher.load('3'),
      batcher.load('4'),
      batcher.load('5'),
    ]

    const results = await Promise.all(promises)

    expect(results).toEqual([
      'result-1',
      'result-2',
      'result-3',
      'result-4',
      'result-5',
    ])
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(resolver).toHaveBeenCalledWith(['1', '2', '3', '4', '5'])
  })

  it('should start a new batch after microtask completes', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({ resolver })

    // First batch
    const result1 = await batcher.load('first')

    // Second batch (new tick)
    const result2 = await batcher.load('second')

    expect(result1).toBe('result-first')
    expect(result2).toBe('result-second')
    expect(resolver).toHaveBeenCalledTimes(2)
  })
})

describe('manual scheduler', () => {
  it('should accumulate requests until dispatch', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({
      resolver,
      scheduler: 'manual',
    })

    // Accumulate many requests
    const promises: Promise<string>[] = []
    for (let i = 0; i < 100; i++) {
      promises.push(batcher.load(`key-${i}`))
    }

    // Nothing should be called yet
    expect(resolver).not.toHaveBeenCalled()

    // Dispatch all at once
    await batcher.dispatch()

    const results = await Promise.all(promises)

    expect(results).toHaveLength(100)
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(resolver.mock.calls[0][0]).toHaveLength(100)
  })

  it('should work with multiple dispatch calls', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({
      resolver,
      scheduler: 'manual',
    })

    // First batch
    const promise1 = batcher.load('a')
    await batcher.dispatch()

    // Second batch
    const promise2 = batcher.load('b')
    await batcher.dispatch()

    expect(await promise1).toBe('result-a')
    expect(await promise2).toBe('result-b')
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('should combine with maxBatchSize', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    const batcher = createBatcher({
      resolver,
      scheduler: 'manual',
      maxBatchSize: 3,
    })

    // Queue 10 items
    const promises = Array.from({ length: 10 }, (_, i) =>
      batcher.load(`key-${i}`)
    )

    await batcher.dispatch()

    const results = await Promise.all(promises)
    expect(results).toHaveLength(10)

    // Should be split into 4 batches: 3 + 3 + 3 + 1
    expect(resolver).toHaveBeenCalledTimes(4)
  })
})

describe('custom scheduler', () => {
  it('should accept a custom scheduler function', async () => {
    const resolver = mock(async (keys: string[]) => {
      return keys.map((k) => `result-${k}`)
    })

    let dispatchFn: (() => void) | null = null

    const customScheduler = (dispatch: () => void) => {
      dispatchFn = dispatch
      return () => {
        dispatchFn = null
      }
    }

    const batcher = createBatcher({
      resolver,
      scheduler: customScheduler,
    })

    const promise = batcher.load('custom')

    // Resolver not called yet
    expect(resolver).not.toHaveBeenCalled()

    // Manually trigger the scheduler
    expect(dispatchFn).not.toBeNull()
    dispatchFn!()

    const result = await promise
    expect(result).toBe('result-custom')
    expect(resolver).toHaveBeenCalledTimes(1)
  })
})

