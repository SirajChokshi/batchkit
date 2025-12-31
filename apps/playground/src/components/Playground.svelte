<script lang="ts">
  import { createBatcher, windowScheduler } from 'batchkit'
  import type { Batcher, SchedulerType } from 'batchkit'
  import { createTelemetryState } from '../lib/useBatcherTelemetry.svelte'
  import ConfigPanel from './ConfigPanel.svelte'
  import Controls from './Controls.svelte'
  import Timeline from './Timeline.svelte'
  import EventLog from './EventLog.svelte'

  // Configuration state
  let schedulerType = $state<'microtask' | 'window' | 'manual'>('microtask')
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
    let scheduler: SchedulerType = 'microtask'
    if (schedulerType === 'window') {
      scheduler = windowScheduler({ wait: windowDelay })
    } else if (schedulerType === 'manual') {
      scheduler = 'manual'
    }

    const newBatcher = createBatcher<string, string>({
      name: 'playground',
      resolver: async (keys) => {
        // Simulate async work
        await new Promise(r => setTimeout(r, resolverDelay))
        return keys.map(key => database.get(key) ?? `Not found: ${key}`)
      },
      scheduler,
      maxBatchSize: maxBatchSize > 0 ? maxBatchSize : undefined,
      _enableTelemetry: true,
    })

    batcher = newBatcher
    telemetry.subscribe(newBatcher)
    telemetry.clear()
  }

  // Initialize batcher on mount
  $effect(() => {
    createNewBatcher()
    return () => telemetry.cleanup()
  })

  // Handlers for controls
  function handleLoadKey() {
    if (!batcher) return
    const key = `user-${(keyCounter++ % 10) + 1}`
    batcher.load(key)
  }

  function handleLoadRandom(count: number) {
    if (!batcher) return
    for (let i = 0; i < count; i++) {
      const id = Math.floor(Math.random() * 100) + 1
      batcher.load(`user-${id}`)
    }
  }

  function handleLoadDuplicate() {
    if (!batcher) return
    const key = 'user-1'
    batcher.load(key)
    batcher.load(key)
    batcher.load(key)
  }

  function handleBurst(count: number) {
    if (!batcher) return
    for (let i = 0; i < count; i++) {
      batcher.load(`user-${(i % 20) + 1}`)
    }
  }

  function handleDispatch() {
    if (!batcher) return
    batcher.dispatch()
  }

  function handleClearTimeline() {
    telemetry.clear()
  }

  function handleConfigChange() {
    createNewBatcher()
  }
</script>

<div class="playground">
  <header class="header">
    <h1>
      <span class="logo">●●●</span>
      Batchkit Playground
    </h1>
    <p class="subtitle">Real-time visualization of request batching</p>
  </header>

  <div class="layout">
    <div class="sidebar">
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
        onDispatch={handleDispatch}
        onClear={handleClearTimeline}
      />
    </div>

    <div class="main-content">
      <Timeline 
        events={telemetry.events} 
        batches={telemetry.batches}
      />

      <EventLog events={telemetry.events} />
    </div>
  </div>
</div>

<style>
  .playground {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .header {
    text-align: center;
    padding: 0.5rem 0;
  }

  .header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .logo {
    color: var(--accent-primary);
    letter-spacing: -0.2em;
    font-size: 1.1rem;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.8rem;
    margin-top: 0.125rem;
  }

  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.25rem;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .main-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  @media (max-width: 800px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
