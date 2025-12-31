<script lang="ts">
interface Props {
  schedulerType: 'microtask' | 'window' | 'animationFrame' | 'idle' | 'manual';
  windowDelay: number;
  maxBatchSize: number;
  resolverDelay: number;
  onConfigChange: () => void;
}

const {
  schedulerType = $bindable(),
  windowDelay = $bindable(),
  maxBatchSize = $bindable(),
  resolverDelay = $bindable(),
  onConfigChange,
}: Props = $props();

function handleChange() {
  onConfigChange();
}
</script>

<div class="bg-stone-900 p-4 border-b border-stone-700">
  <h3 class="text-xs uppercase tracking-wide text-stone-500 mb-4 font-mono">Configuration</h3>
  
  <div class="mb-4">
    <label for="scheduler" class="flex justify-between items-center text-sm text-stone-400 mb-2 font-mono">Scheduler</label>
    <select 
      id="scheduler" 
      bind:value={schedulerType} 
      onchange={handleChange}
      class="w-full p-2 bg-stone-800 border border-stone-700 text-stone-100 text-sm cursor-pointer font-mono focus:outline-none focus:border-stone-500"
    >
      <option value="microtask">Microtask (default)</option>
      <option value="window">Wait (time-based)</option>
      <option value="animationFrame">Animation Frame</option>
      <option value="idle">Idle</option>
    </select>
  </div>

  {#if schedulerType === 'window'}
    <div class="mb-4">
      <label for="window-delay" class="flex justify-between items-center text-sm text-stone-400 mb-2 font-mono">
        Wait: <span class="text-stone-100">{windowDelay}ms</span>
      </label>
      <input 
        type="range" 
        id="window-delay"
        min="5" 
        max="200" 
        step="5"
        bind:value={windowDelay}
        onchange={handleChange}
        class="w-full h-1.5 bg-stone-700 cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-stone-100 [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  {/if}

  <div class="mb-4">
    <label for="max-batch" class="flex justify-between items-center text-sm text-stone-400 mb-2 font-mono">
      Max Batch Size: <span class="text-stone-100">{maxBatchSize === 0 ? 'Unlimited' : maxBatchSize}</span>
    </label>
    <input 
      type="range" 
      id="max-batch"
      min="0" 
      max="20" 
      step="1"
      bind:value={maxBatchSize}
      onchange={handleChange}
      class="w-full h-1.5 bg-stone-700 cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-stone-100 [&::-webkit-slider-thumb]:cursor-pointer"
    />
  </div>

  <div>
    <label for="resolver-delay" class="flex justify-between items-center text-sm text-stone-400 mb-2 font-mono">
      Fetch Delay: <span class="text-stone-100">{resolverDelay}ms</span>
    </label>
    <input 
      type="range" 
      id="resolver-delay"
      min="0" 
      max="500" 
      step="10"
      bind:value={resolverDelay}
      onchange={handleChange}
      class="w-full h-1.5 bg-stone-700 cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-stone-100 [&::-webkit-slider-thumb]:cursor-pointer"
    />
  </div>
</div>
