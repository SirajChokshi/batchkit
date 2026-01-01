<script lang="ts">
interface Props {
  schedulerType: 'microtask' | 'window' | 'animationFrame' | 'idle' | 'manual';
  onLoadKey: () => void;
  onLoadRandom: (count: number) => void;
  onLoadDuplicate: () => void;
  onBurst: (count: number) => void;
  onFlush: () => void;
  onClear: () => void;
}

const {
  schedulerType,
  onLoadKey,
  onLoadRandom,
  onLoadDuplicate,
  onBurst,
  onFlush,
  onClear,
}: Props = $props();
</script>

<div class="bg-stone-900 p-3 h-full">
  <h3 class="text-xs uppercase tracking-wider text-stone-500 mb-3 font-mono">Controls</h3>
  
  <!-- Button group with shared border -->
  <div class="border border-stone-700 flex mb-2">
    <button 
      onclick={onLoadKey}
      class="flex-1 px-2 py-1.5 text-sm font-mono text-stone-100 bg-stone-800 hover:bg-stone-700 cursor-pointer"
    >
      Load Key
    </button>
    <button 
      onclick={() => onLoadRandom(5)}
      class="flex-1 px-2 py-1.5 text-sm font-mono text-stone-400 bg-stone-900 border-l border-stone-700 hover:bg-stone-800 hover:text-stone-100 cursor-pointer"
    >
      Load 5
    </button>
    <button 
      onclick={onLoadDuplicate}
      class="flex-1 px-2 py-1.5 text-sm font-mono text-stone-400 bg-stone-900 border-l border-stone-700 hover:bg-stone-800 hover:text-stone-100 cursor-pointer"
    >
      Dup ×3
    </button>
  </div>

  <div class="border border-stone-700 flex mb-2">
    <button 
      onclick={() => onBurst(20)}
      class="flex-1 px-2 py-1.5 text-sm font-mono text-stone-400 bg-stone-900 hover:bg-stone-800 hover:text-stone-100 cursor-pointer"
    >
      Burst 20
    </button>
    {#if schedulerType === 'manual'}
      <button 
        onclick={onFlush}
        class="flex-1 px-2 py-1.5 text-sm font-mono text-stone-100 bg-stone-800 border-l border-stone-700 hover:bg-stone-700 cursor-pointer"
      >
        Flush
      </button>
    {/if}
  </div>

  <div class="h-px bg-stone-800 my-2"></div>

  <button 
    onclick={onClear}
    class="w-full px-2 py-1 text-xs font-mono text-stone-500 bg-transparent hover:text-stone-300 hover:bg-stone-800 cursor-pointer"
  >
    Clear
  </button>
</div>
