<script lang="ts">
  import { batch, onAnimationFrame, onIdle } from 'batchkit'
  import type { Batcher, Scheduler } from 'batchkit'
  import { createTelemetryState } from '../lib/useBatcherTelemetry.svelte'
  import ConfigPanel from './ConfigPanel.svelte'
  import Controls from './Controls.svelte'
  import Timeline from './Timeline.svelte'
  import EventLog from './EventLog.svelte'

  // Configuration state
  let schedulerType = $state<'microtask' | 'window' | 'animationFrame' | 'idle' | 'manual'>('microtask')
  let windowDelay = $state(10)
  let maxBatchSize = $state(0) // 0 = unlimited
  let resolverDelay = $state(50)

  // Telemetry state
  const telemetry = createTelemetryState()

  // Current batcher instance
  let batcher = $state<Batcher<string, string> | null>(null)
  let keyCounter = $state(0)

  // Simulated database
  const database = new Map<string, string>()
  for (let i = 1; i <= 100; i++) {
    database.set(`user-${i}`, `User #${i}`)
  }

  // Create/recreate batcher when config changes
  function createNewBatcher() {
    // Clear previous state
    telemetry.clear()

    // Determine scheduler
    let schedule: Scheduler | undefined
    let wait: number | undefined

    if (schedulerType === 'window') {
      wait = windowDelay
    } else if (schedulerType === 'animationFrame') {
      schedule = onAnimationFrame
    } else if (schedulerType === 'idle') {
      schedule = onIdle({ timeout: 100 })
    }
    // For 'microtask', leave both undefined (default)
    // For 'manual', we'll handle flush manually

    const newBatcher = batch<string, string>(
      async (keys, _signal) => {
        // Simulate async work
        await new Promise(r => setTimeout(r, resolverDelay))
        return keys.map(key => ({ id: key, value: database.get(key) ?? `Not found: ${key}` }))
      },
      'id',
      {
        wait,
        schedule,
        max: maxBatchSize > 0 ? maxBatchSize : undefined,
        name: 'playground',
        trace: telemetry.createTraceHandler(),
      }
    )

    batcher = newBatcher
  }

  // Initialize batcher on mount
  $effect(() => {
    createNewBatcher()
  })

  // Handlers for controls
  function handleLoadKey() {
    if (!batcher) return
    const key = `user-${(keyCounter++ % 10) + 1}`
    batcher.get(key)
  }

  function handleLoadRandom(count: number) {
    if (!batcher) return
    for (let i = 0; i < count; i++) {
      const id = Math.floor(Math.random() * 100) + 1
      batcher.get(`user-${id}`)
    }
  }

  function handleLoadDuplicate() {
    if (!batcher) return
    const key = 'user-1'
    batcher.get(key)
    batcher.get(key)
    batcher.get(key)
  }

  function handleBurst(count: number) {
    if (!batcher) return
    for (let i = 0; i < count; i++) {
      batcher.get(`user-${(i % 20) + 1}`)
    }
  }

  function handleFlush() {
    if (!batcher) return
    batcher.flush()
  }

  function handleClearTimeline() {
    telemetry.clear()
  }

  function handleConfigChange() {
    createNewBatcher()
  }
</script>

<div class="flex flex-col gap-6">
  <header class="flex items-center gap-2 py-2 border-b border-stone-700">
    <h1 class="text-sm font-medium text-stone-100 font-mono">batchkit</h1>
    <span class="text-sm text-stone-500">/</span>
    <span class="text-sm text-stone-500 font-mono">playground</span>
  </header>

  <div class="grid grid-cols-[280px_1fr] max-md:grid-cols-1 border border-stone-700">
    <div class="flex flex-col border-r border-stone-700 max-md:border-r-0 max-md:border-b">
      <ConfigPanel
        bind:schedulerType
        bind:windowDelay
        bind:maxBatchSize
        bind:resolverDelay
        onConfigChange={handleConfigChange}
      />

      <Controls
        {schedulerType}
        onLoadKey={handleLoadKey}
        onLoadRandom={handleLoadRandom}
        onLoadDuplicate={handleLoadDuplicate}
        onBurst={handleBurst}
        onFlush={handleFlush}
        onClear={handleClearTimeline}
      />
    </div>

    <div class="flex flex-col min-w-0">
      <Timeline 
        events={telemetry.events} 
        batches={telemetry.batches}
      />

      <EventLog events={telemetry.events} />
    </div>
  </div>
</div>
