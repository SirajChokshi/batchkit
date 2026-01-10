<script lang="ts">
  import { mount } from 'batchkit-devtools';
  import { onMount } from 'svelte';

  export interface Props {
    position?: 'right' | 'bottom' | 'left';
    defaultOpen?: boolean;
    buttonClass?: string;
    buttonStyle?: Record<string, string>;
    panelClass?: string;
    panelStyle?: Record<string, string>;
    projectRoot?: string;
    editor?: 'vscode' | 'cursor' | 'webstorm' | 'idea';
  }

  let { 
    position,
    defaultOpen,
    buttonClass,
    buttonStyle,
    panelClass,
    panelStyle,
    projectRoot,
    editor,
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
      projectRoot,
      editor,
    });
    
    return () => {
      dispose();
    };
  });
</script>

<div bind:this={container} data-batchkit-devtools></div>
