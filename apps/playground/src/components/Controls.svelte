<script lang="ts">
  interface Props {
    schedulerType: 'microtask' | 'window' | 'manual'
    onLoadKey: () => void
    onLoadRandom: (count: number) => void
    onLoadDuplicate: () => void
    onBurst: (count: number) => void
    onDispatch: () => void
    onClear: () => void
  }

  let { 
    schedulerType,
    onLoadKey, 
    onLoadRandom, 
    onLoadDuplicate,
    onBurst,
    onDispatch,
    onClear
  }: Props = $props()
</script>

<div class="controls">
  <h3>Controls</h3>
  
  <div class="button-group">
    <button class="btn btn-primary" onclick={onLoadKey}>
      Load Key
    </button>
    <button class="btn btn-secondary" onclick={() => onLoadRandom(5)}>
      Load 5 Random
    </button>
    <button class="btn btn-secondary" onclick={onLoadDuplicate}>
      Load Duplicate ×3
    </button>
  </div>

  <div class="button-group">
    <button class="btn btn-accent" onclick={() => onBurst(20)}>
      Burst 20
    </button>
    {#if schedulerType === 'manual'}
      <button class="btn btn-success" onclick={onDispatch}>
        Dispatch
      </button>
    {/if}
  </div>

  <div class="divider"></div>

  <button class="btn btn-ghost" onclick={onClear}>
    Clear Timeline
  </button>
</div>

<style>
  .controls {
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

  .button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .btn {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn:hover {
    background: var(--bg-secondary);
    border-color: var(--text-muted);
  }

  .btn:active {
    transform: scale(0.98);
  }

  .btn-primary {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: var(--bg-primary);
  }

  .btn-primary:hover {
    background: color-mix(in srgb, var(--accent-primary) 85%, white);
    border-color: color-mix(in srgb, var(--accent-primary) 85%, white);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .btn-secondary:hover {
    background: color-mix(in srgb, var(--accent-primary) 15%, var(--bg-tertiary));
  }

  .btn-accent {
    background: var(--accent-secondary);
    border-color: var(--accent-secondary);
    color: var(--bg-primary);
  }

  .btn-accent:hover {
    background: color-mix(in srgb, var(--accent-secondary) 85%, white);
    border-color: color-mix(in srgb, var(--accent-secondary) 85%, white);
  }

  .btn-success {
    background: var(--accent-success);
    border-color: var(--accent-success);
    color: var(--bg-primary);
  }

  .btn-success:hover {
    background: color-mix(in srgb, var(--accent-success) 85%, white);
  }

  .btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--text-muted);
  }

  .btn-ghost:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.75rem 0;
  }
</style>

