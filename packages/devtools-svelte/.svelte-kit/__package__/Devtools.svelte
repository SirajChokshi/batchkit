<script lang="ts">
  import { mount } from 'batchkit-devtools';
  import { onMount } from 'svelte';

  interface Props {
    buttonClass?: string;
    buttonStyle?: Record<string, string>;
    panelClass?: string;
    panelStyle?: Record<string, string>;
  }

  let { 
    buttonClass,
    buttonStyle,
    panelClass,
    panelStyle,
  }: Props = $props();
  
  let container: HTMLDivElement | undefined = $state();

  onMount(() => {
    if (!container) return;
    
    const dispose = mount(container, {
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

<div
  bind:this={container}
  data-batchkit-devtools
></div>

