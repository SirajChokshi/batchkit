<script lang="ts">
  // HACK: Import directly from source to bypass production check
  // This is only for the docs site demo - don't do this in real apps
  import { mount } from 'batchkit-devtools/src/mount';
  import { onMount } from 'svelte';

  interface Props {
    position?: 'right' | 'bottom' | 'left';
    defaultOpen?: boolean;
    buttonClass?: string;
    buttonStyle?: Record<string, string>;
    panelClass?: string;
    panelStyle?: Record<string, string>;
  }

  let { 
    position,
    defaultOpen,
    buttonClass,
    buttonStyle,
    panelClass,
    panelStyle,
  }: Props = $props();
  
  let container: HTMLDivElement | undefined = $state();

  onMount(() => {
    if (!container) return;
    
    const dispose = mount(container, {
      position,
      defaultOpen,
      buttonClass,
      buttonStyle,
      panelClass,
      panelStyle,
    });
    
    return () => {
      dispose();
    };
  });
</script>

<div bind:this={container} data-batchkit-devtools></div>

