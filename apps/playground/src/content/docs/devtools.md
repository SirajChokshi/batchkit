---
title: DevTools
description: Visualize batching in real-time
order: 4
---

# DevTools

See exactly how your requests are being batched in real-time.

<!-- screenshot: devtools panel -->

## Installation

```bash
# Svelte
npm install -D batchkit-devtools-svelte

# React
npm install -D batchkit-devtools-react
```

## Setup

Add the DevTools component once, at your app root.

### Svelte

```svelte
<script>
  import { BatchkitDevtools } from 'batchkit-devtools-svelte';
</script>

<BatchkitDevtools />
```

### React

```tsx
import { BatchkitDevtools } from 'batchkit-devtools-react';

function App() {
  return (
    <>
      <YourApp />
      <BatchkitDevtools />
    </>
  );
}
```

## Enabling Tracing

DevTools automatically track any batcher with a `name`:

```typescript
const users = batch(fn, 'id', { name: 'users' })
//                              ^^^^^^^^^^^^^^
```

That's it. The batcher now appears in DevTools.

## What You'll See

**Batchers** — All named batchers in your app, with request counts.

**Timeline** — Each batch with its status, keys, and duration.

**Events** — Full trace log: `get`, `dedup`, `schedule`, `dispatch`, `resolve`, `error`, `abort`.

**Stats** — Totals, deduplication rate, average batch size and timing.

## Positioning

The toggle button appears in the bottom-right by default. Override with props:

```svelte
<BatchkitDevtools 
  buttonStyle={{ bottom: '80px', right: '80px' }}
  buttonClass="my-custom-class"
/>
```

## Production

DevTools add no overhead when batchers don't have names. For production, either:

1. Remove names from batchers
2. Conditionally render the component
3. Use tree-shaking (the component no-ops without the registry)

```svelte
{#if dev}
  <BatchkitDevtools />
{/if}
```

## Filtering

Click a batcher name in the sidebar to filter Timeline, Events, and Stats to just that batcher. Click again to clear the filter.

