<script lang="ts">
import type { Batcher, Scheduler } from 'batchkit';
import { batch, onAnimationFrame, onIdle } from 'batchkit';
import { createTelemetryState } from '../lib/useBatcherTelemetry.svelte';
import ConfigPanel from './ConfigPanel.svelte';
import Controls from './Controls.svelte';
import EventLog from './EventLog.svelte';
import Timeline from './Timeline.svelte';

// Configuration state
let schedulerType: 'microtask' | 'window' | 'animationFrame' | 'idle' | 'manual' = $state('microtask');
let windowDelay = $state(10);
let maxBatchSize = $state(0); // 0 = unlimited
let resolverDelay = $state(50);

// Telemetry state
const telemetry = createTelemetryState();

// Current batcher instance
let batcher: Batcher<string, { id: string; value: string }> | null = $state(null);
let keyCounter = $state(0);

// Hover state for cross-highlighting
let hoveredBatchId: string | null = $state(null);

// Simulated database
const database = new Map<string, string>();
for (let i = 1; i <= 100; i++) {
  database.set(`user-${i}`, `User #${i}`);
}

// Create/recreate batcher when config changes
function createNewBatcher() {
  // Clear previous state
  telemetry.clear();

  // Determine scheduler
  let schedule: Scheduler | undefined;
  let wait: number | undefined;

  if (schedulerType === 'window') {
    wait = windowDelay;
  } else if (schedulerType === 'animationFrame') {
    schedule = onAnimationFrame;
  } else if (schedulerType === 'idle') {
    schedule = onIdle({ timeout: 100 });
  }
  // For 'microtask', leave both undefined (default)
  // For 'manual', we'll handle flush manually

  const newBatcher = batch<string, { id: string; value: string }>(
    async (keys, _signal) => {
      // Simulate async work
      await new Promise((r) => setTimeout(r, resolverDelay));
      return keys.map((key) => ({
        id: key,
        value: database.get(key) ?? `Not found: ${key}`,
      }));
    },
    'id',
    {
      wait,
      schedule,
      max: maxBatchSize > 0 ? maxBatchSize : undefined,
      name: 'playground',
      trace: telemetry.createTraceHandler(),
    },
  );

  batcher = newBatcher;
}

// Initialize batcher on mount
$effect(() => {
  createNewBatcher();
});

// Handlers for controls
function handleLoadKey() {
  if (!batcher) return;
  const key = `user-${(keyCounter++ % 10) + 1}`;
  batcher.get(key);
}

function handleLoadRandom(count: number) {
  if (!batcher) return;
  for (let i = 0; i < count; i++) {
    const id = Math.floor(Math.random() * 100) + 1;
    batcher.get(`user-${id}`);
  }
}

function handleLoadDuplicate() {
  if (!batcher) return;
  const key = 'user-1';
  batcher.get(key);
  batcher.get(key);
  batcher.get(key);
}

function handleBurst(count: number) {
  if (!batcher) return;
  for (let i = 0; i < count; i++) {
    batcher.get(`user-${(i % 20) + 1}`);
  }
}

function handleFlush() {
  if (!batcher) return;
  batcher.flush();
}

function handleClearTimeline() {
  telemetry.clear();
}

function handleConfigChange() {
  createNewBatcher();
}
</script>

<div class="flex flex-col h-full min-h-0 mt-4 border border-stone-700">
  <!-- Main 3-column layout -->
  <div class="flex-1 grid grid-cols-12 max-lg:grid-cols-1 min-h-0 h-full">
    <!-- Left: Controls -->
    <div class="flex flex-col border-r border-stone-700 overflow-y-auto max-lg:border-r-0 max-lg:border-b col-span-3">
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

    <!-- Center: Batching Demo -->
    <div class="flex flex-col min-w-0 overflow-y-auto col-span-6">
      <Timeline
        events={telemetry.events} 
        batches={telemetry.batches}
        onHoverBatch={(id) => hoveredBatchId = id}
      />
    </div>

    <!-- Right: Event Log -->
    <div class="flex flex-col min-w-0 border-l border-stone-700 overflow-y-auto max-lg:border-l-0 max-lg:border-t col-span-3">
      <EventLog events={telemetry.events} {hoveredBatchId} />
    </div>
  </div>
</div>
