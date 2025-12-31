import { describe, it, expect, mock } from 'bun:test'
import { createBatcher, TelemetryEmitter } from '../src'
import type { TelemetryEvent } from '../src'

describe('telemetry', () => {
  describe('_enableTelemetry option', () => {
    it('should have telemetry disabled by default', () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
      })

      expect(batcher._telemetry.enabled).toBe(false)
    })

    it('should enable telemetry when _enableTelemetry is true', () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      expect(batcher._telemetry.enabled).toBe(true)
    })
  })

  describe('event subscription', () => {
    it('should emit load:called when load() is called', async () => {
      const events: TelemetryEvent<string, string>[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
        name: 'test-batcher',
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      await batcher.load('key-1')

      const loadCalled = events.find((e) => e.type === 'load:called')
      expect(loadCalled).toBeDefined()
      expect(loadCalled?.data.key).toBe('key-1')
      expect(loadCalled?.data.batcherId).toBe('test-batcher')
    })

    it('should emit batch:dispatching and batch:resolved on successful batch', async () => {
      const events: TelemetryEvent<string, string>[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys.map((k) => k.toUpperCase()),
        _enableTelemetry: true,
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      await Promise.all([batcher.load('a'), batcher.load('b')])

      const dispatching = events.find((e) => e.type === 'batch:dispatching')
      expect(dispatching).toBeDefined()
      expect(dispatching?.data.keys).toEqual(['a', 'b'])

      const resolved = events.find((e) => e.type === 'batch:resolved')
      expect(resolved).toBeDefined()
      expect(resolved?.data.keys).toEqual(['a', 'b'])
      expect(resolved?.data.results).toEqual(['A', 'B'])
      expect(typeof resolved?.data.duration).toBe('number')
    })

    it('should emit batch:error when resolver throws', async () => {
      const events: TelemetryEvent<string, never>[] = []

      const batcher = createBatcher<string, never>({
        resolver: async () => {
          throw new Error('Database error')
        },
        _enableTelemetry: true,
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      await Promise.allSettled([batcher.load('a')])

      const errorEvent = events.find((e) => e.type === 'batch:error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.data.error.message).toBe('Database error')
    })

    it('should emit load:deduped for duplicate keys', async () => {
      const events: TelemetryEvent<string, string>[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      await Promise.all([
        batcher.load('same'),
        batcher.load('same'),
        batcher.load('same'),
      ])

      const dedupedEvents = events.filter((e) => e.type === 'load:deduped')
      // First call is not deduped, subsequent ones are
      expect(dedupedEvents.length).toBe(2)
    })

    it('should emit load:cached for cached keys', async () => {
      const events: TelemetryEvent<string, string>[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      batcher.prime('cached', 'cached-value')
      await batcher.load('cached')

      const cachedEvent = events.find((e) => e.type === 'load:cached')
      expect(cachedEvent).toBeDefined()
      expect(cachedEvent?.data.key).toBe('cached')
      expect(cachedEvent?.data.value).toBe('cached-value')
    })

    it('should emit cache:primed when prime() is called', () => {
      const events: TelemetryEvent<string, string>[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      batcher.prime('key', 'value')

      const primedEvent = events.find((e) => e.type === 'cache:primed')
      expect(primedEvent).toBeDefined()
      expect(primedEvent?.data.key).toBe('key')
      expect(primedEvent?.data.value).toBe('value')
    })

    it('should emit cache:cleared when clear() is called', () => {
      const events: TelemetryEvent<string, string>[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      batcher.prime('key', 'value')
      batcher.clear('key')

      const clearedEvent = events.find((e) => e.type === 'cache:cleared')
      expect(clearedEvent).toBeDefined()
      expect(clearedEvent?.data.key).toBe('key')
    })

    it('should emit cache:cleared-all when clearAll() is called', () => {
      const events: TelemetryEvent<string, string>[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      batcher.prime('key1', 'value1')
      batcher.prime('key2', 'value2')
      batcher.clearAll()

      const clearedAllEvent = events.find((e) => e.type === 'cache:cleared-all')
      expect(clearedAllEvent).toBeDefined()
    })
  })

  describe('event filtering with on()', () => {
    it('should only receive events of subscribed type', async () => {
      const loadEvents: unknown[] = []
      const batchEvents: unknown[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      batcher._telemetry.on('load:called', (data) => {
        loadEvents.push(data)
      })

      batcher._telemetry.on('batch:resolved', (data) => {
        batchEvents.push(data)
      })

      await batcher.load('test')

      expect(loadEvents.length).toBe(1)
      expect(batchEvents.length).toBe(1)
    })

    it('should support unsubscribing', async () => {
      const events: unknown[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      const unsubscribe = batcher._telemetry.on('load:called', (data) => {
        events.push(data)
      })

      await batcher.load('first')
      expect(events.length).toBe(1)

      unsubscribe()

      await batcher.load('second')
      expect(events.length).toBe(1) // No new event
    })
  })

  describe('getEvents() and clear()', () => {
    it('should store all events', async () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      await Promise.all([batcher.load('a'), batcher.load('b')])

      const events = batcher._telemetry.getEvents()
      expect(events.length).toBeGreaterThan(0)

      // Should have load:called, batch:scheduled, batch:dispatching, batch:resolved
      const types = events.map((e) => e.type)
      expect(types).toContain('load:called')
      expect(types).toContain('batch:dispatching')
      expect(types).toContain('batch:resolved')
    })

    it('should clear event history', async () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      await batcher.load('test')
      expect(batcher._telemetry.getEvents().length).toBeGreaterThan(0)

      batcher._telemetry.clear()
      expect(batcher._telemetry.getEvents().length).toBe(0)
    })
  })

  describe('disabled telemetry', () => {
    it('should not emit events when disabled', async () => {
      const events: unknown[] = []

      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        // _enableTelemetry not set (defaults to false)
      })

      batcher._telemetry.onAll((event) => {
        events.push(event)
      })

      await batcher.load('test')

      expect(events.length).toBe(0)
      expect(batcher._telemetry.getEvents().length).toBe(0)
    })
  })

  describe('TelemetryEmitter class', () => {
    it('should generate unique batch IDs', () => {
      const emitter = new TelemetryEmitter('test', true)

      const id1 = emitter.nextBatchId()
      const id2 = emitter.nextBatchId()
      const id3 = emitter.nextBatchId()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).toContain('test:batch-')
    })

    it('should not throw when handler throws', () => {
      const emitter = new TelemetryEmitter<string, string>('test', true)

      emitter.on('load:called', () => {
        throw new Error('Handler error')
      })

      // Should not throw
      expect(() => {
        emitter.emit('load:called', { key: 'test' })
      }).not.toThrow()
    })
  })

  describe('timestamps', () => {
    it('should include timestamps on all events', async () => {
      const batcher = createBatcher({
        resolver: async (keys: string[]) => keys,
        _enableTelemetry: true,
      })

      await batcher.load('test')

      const events = batcher._telemetry.getEvents()

      for (const event of events) {
        expect(typeof event.data.timestamp).toBe('number')
        expect(event.data.timestamp).toBeGreaterThan(0)
      }
    })
  })
})

