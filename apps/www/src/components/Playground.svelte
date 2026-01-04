<script lang="ts">
import type { Batcher, Scheduler } from 'batchkit';
import { batch, onAnimationFrame, onIdle } from 'batchkit';
import { BatchkitDevtools } from 'batchkit-devtools-svelte';
import ConfigPanel from './ConfigPanel.svelte';
import Controls from './Controls.svelte';
import CodePreview from './CodePreview.svelte';
import Presets from './Presets.svelte';

// Configuration state
let schedulerType: 'microtask' | 'window' | 'animationFrame' | 'idle' = $state('microtask');
let windowDelay = $state(50);
let maxBatchSize = $state(0);
let resolverDelay = $state(50);

// Current batcher instance
let batcher: Batcher<string, { id: string; value: string }> | null = $state(null);
let keyCounter = $state(0);

// Simulated database
const database = new Map<string, string>();
for (let i = 1; i <= 100; i++) {
  database.set(`user-${i}`, `User #${i}`);
}

// Create/recreate batcher when config changes
function createNewBatcher() {
  let schedule: Scheduler | undefined;
  let wait: number | undefined;

  if (schedulerType === 'window') {
    wait = windowDelay;
  } else if (schedulerType === 'animationFrame') {
    schedule = onAnimationFrame;
  } else if (schedulerType === 'idle') {
    schedule = onIdle({ timeout: 100 });
  }

  const newBatcher = batch<string, { id: string; value: string }>(
    async (keys, _signal) => {
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
      // name: 'custom',
    },
  );

  batcher = newBatcher;
}

// Initialize batcher on client-side only
if (typeof window !== 'undefined') {
  createNewBatcher();
}

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

function handleClear() {
  // Clear is handled via the devtools Clear button
}

function handleConfigChange() {
  createNewBatcher();
}
</script>

<div class="flex flex-col h-full min-h-0 mt-4 border border-stone-700">
  <!-- <img
    src="https://images.unsplash.com/photo-1635776062043-223faf322554?q=80&w=4032&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    alt="Batchkit DevTools"
    class="w-full h-full object-cover z-100 fixed inset-0"
  /> -->
  <div class="flex-1 grid grid-cols-12 max-lg:grid-cols-1 min-h-0 h-full">
    <!-- Left: Custom Batcher Config + Controls + Code Preview -->
    <div class="flex flex-col border-r border-stone-700 max-lg:border-r-0 max-lg:border-b col-span-4 min-h-0">
      <div class="shrink-0">
        <ConfigPanel
          bind:schedulerType
          bind:windowDelay
          bind:maxBatchSize
          bind:resolverDelay
          onConfigChange={handleConfigChange}
        />
        <div class="hidden lg:block">
          <Controls
            {schedulerType}
            onLoadKey={handleLoadKey}
            onLoadRandom={handleLoadRandom}
            onLoadDuplicate={handleLoadDuplicate}
            onBurst={handleBurst}
            onFlush={handleFlush}
            onClear={handleClear}
          />
        </div>
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto">
        <CodePreview
          {schedulerType}
          {windowDelay}
          {maxBatchSize}
          {resolverDelay}
        />
      </div>
    </div>

    <!-- Right: Presets (hidden on mobile) -->
    <div class="hidden lg:flex flex-col min-w-0 overflow-hidden col-span-8">
      <Presets />
    </div>
  </div>
</div>

<!-- DevTools (hidden on mobile) -->
<div class="hidden lg:block">
  <BatchkitDevtools defaultOpen={true} />
</div>
