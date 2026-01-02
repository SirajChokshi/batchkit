<script lang="ts">
interface Props {
  schedulerType: 'microtask' | 'window' | 'animationFrame' | 'idle';
  windowDelay: number;
  maxBatchSize: number;
  resolverDelay: number;
}

const { schedulerType, windowDelay, maxBatchSize, resolverDelay }: Props = $props();

let copied = $state(false);

const generatedCode = $derived.by(() => {
  const lines: string[] = [];
  
  lines.push(`import { batch${schedulerType === 'animationFrame' ? ', onAnimationFrame' : ''}${schedulerType === 'idle' ? ', onIdle' : ''} } from 'batchkit';`);
  lines.push('');
  lines.push('const custom = batch(');
  lines.push('  async (keys, signal) => {');
  lines.push(`    // Simulate ${resolverDelay}ms fetch`);
  lines.push('    const response = await fetch(\'/api/batch\', {');
  lines.push('      method: \'POST\',');
  lines.push('      body: JSON.stringify({ keys }),');
  lines.push('      signal,');
  lines.push('    });');
  lines.push('    return response.json();');
  lines.push('  },');
  lines.push('  \'id\',');
  
  const options: string[] = [];
  options.push(`name: 'custom'`);
  
  if (schedulerType === 'window') {
    options.push(`wait: ${windowDelay}`);
  } else if (schedulerType === 'animationFrame') {
    options.push('schedule: onAnimationFrame');
  } else if (schedulerType === 'idle') {
    options.push('schedule: onIdle({ timeout: 100 })');
  }
  
  if (maxBatchSize > 0) {
    options.push(`max: ${maxBatchSize}`);
  }
  
  lines.push('  { ' + options.join(', ') + ' }');
  lines.push(');');
  
  return lines.join('\n');
});

async function copyCode() {
  try {
    await navigator.clipboard.writeText(generatedCode);
    copied = true;
    setTimeout(() => copied = false, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}
</script>

<div class="bg-stone-900 border-t border-stone-700 flex flex-col">
  <div class="flex items-center justify-between px-3 py-2 border-b border-stone-800">
    <h3 class="text-xs uppercase tracking-wider text-stone-500 font-mono">Code</h3>
    <button 
      onclick={copyCode}
      class="text-xs font-mono text-stone-500 hover:text-stone-300 cursor-pointer"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  </div>
  
  <div class="p-3 overflow-x-auto">
    <pre class="text-xs font-mono leading-relaxed"><code>{#each generatedCode.split('\n') as line, i}<span class="text-stone-600 select-none">{String(i + 1).padStart(2, ' ')} </span>{#if line.includes('import')}<span class="text-stone-500">{line}</span>{:else if line.includes('const custom')}<span class="text-stone-400">{line}</span>{:else if line.includes('//')}<span class="text-stone-600">{line}</span>{:else if line.includes('async') || line.includes('await')}<span class="text-stone-400">{line}</span>{:else}<span class="text-stone-500">{line}</span>{/if}
{/each}</code></pre>
  </div>
</div>

