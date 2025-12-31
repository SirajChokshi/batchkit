<script lang="ts">
  interface Props {
    schedulerType: 'microtask' | 'window' | 'manual'
    windowDelay: number
    maxBatchSize: number
    resolverDelay: number
    onConfigChange: () => void
  }

  let { 
    schedulerType = $bindable(), 
    windowDelay = $bindable(), 
    maxBatchSize = $bindable(),
    resolverDelay = $bindable(),
    onConfigChange 
  }: Props = $props()

  function handleChange() {
    onConfigChange()
  }
</script>

<div class="config-panel">
  <h3>Configuration</h3>
  
  <div class="field">
    <label for="scheduler">Scheduler</label>
    <select id="scheduler" bind:value={schedulerType} onchange={handleChange}>
      <option value="microtask">Microtask (default)</option>
      <option value="window">Window (time-based)</option>
      <option value="manual">Manual</option>
    </select>
  </div>

  {#if schedulerType === 'window'}
    <div class="field">
      <label for="window-delay">
        Window Delay: <span class="value">{windowDelay}ms</span>
      </label>
      <input 
        type="range" 
        id="window-delay"
        min="5" 
        max="200" 
        step="5"
        bind:value={windowDelay}
        onchange={handleChange}
      />
    </div>
  {/if}

  <div class="field">
    <label for="max-batch">
      Max Batch Size: <span class="value">{maxBatchSize === 0 ? 'Unlimited' : maxBatchSize}</span>
    </label>
    <input 
      type="range" 
      id="max-batch"
      min="0" 
      max="20" 
      step="1"
      bind:value={maxBatchSize}
      onchange={handleChange}
    />
  </div>

  <div class="field">
    <label for="resolver-delay">
      Resolver Delay: <span class="value">{resolverDelay}ms</span>
    </label>
    <input 
      type="range" 
      id="resolver-delay"
      min="0" 
      max="500" 
      step="10"
      bind:value={resolverDelay}
      onchange={handleChange}
    />
  </div>
</div>

<style>
  .config-panel {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
  }

  h3 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .field {
    margin-bottom: 1rem;
  }

  .field:last-child {
    margin-bottom: 0;
  }

  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .value {
    font-family: var(--font-mono);
    color: var(--accent-primary);
    font-size: 0.8rem;
  }

  select {
    width: 100%;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: var(--accent-primary);
  }

  input[type="range"] {
    width: 100%;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    cursor: pointer;
    -webkit-appearance: none;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--accent-primary);
    border-radius: 50%;
    cursor: pointer;
  }

  input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: var(--accent-primary);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
</style>

