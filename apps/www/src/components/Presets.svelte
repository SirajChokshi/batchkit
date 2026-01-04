<script lang="ts">
import { batch, type Batcher } from 'batchkit';
import { onMount } from 'svelte';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  authorId: string;
}

let userBatcher: Batcher<string, User> | null = $state(null);
let postBatcher: Batcher<string, Post> | null = $state(null);
let slowBatcher: Batcher<string, { id: string; data: string }> | null = $state(null);

let isRunning = $state(false);

onMount(() => {
  userBatcher = batch<string, User>(
    async (ids, _signal) => {
      await new Promise((r) => setTimeout(r, 300));
      return ids.map((id) => ({
        id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
      }));
    },
    'id',
    { name: 'users', wait: 50 }
  );

  postBatcher = batch<string, Post>(
    async (ids, _signal) => {
      await new Promise((r) => setTimeout(r, 200));
      return ids.map((id) => ({
        id,
        title: `Post ${id}`,
        authorId: `user-${Math.floor(Math.random() * 10) + 1}`,
      }));
    },
    'id',
    { name: 'posts', wait: 50 }
  );

  slowBatcher = batch<string, { id: string; data: string }>(
    async (ids, _signal) => {
      await new Promise((r) => setTimeout(r, 1500));
      return ids.map((id) => ({
        id,
        data: `Data for ${id}`,
      }));
    },
    'id',
    { name: 'slow-api', wait: 100 }
  );
});

const presets = [
  {
    name: 'Quick Burst',
    description: '10 rapid requests batched together',
    action: async () => {
      if (!userBatcher) return;
      isRunning = true;
      const promises = [];
      for (let i = 1; i <= 10; i++) {
        promises.push(userBatcher.get(`user-${i}`));
      }
      await Promise.all(promises);
      isRunning = false;
    },
  },
  {
    name: 'Staggered',
    description: 'Requests across multiple batches',
    action: async () => {
      if (!userBatcher) return;
      isRunning = true;
      userBatcher.get('user-1');
      userBatcher.get('user-2');
      await new Promise((r) => setTimeout(r, 100));
      userBatcher.get('user-3');
      userBatcher.get('user-4');
      await new Promise((r) => setTimeout(r, 100));
      userBatcher.get('user-5');
      await new Promise((r) => setTimeout(r, 400));
      isRunning = false;
    },
  },
  {
    name: 'Deduplication',
    description: 'Same keys requested 3x',
    action: async () => {
      if (!userBatcher) return;
      isRunning = true;
      const promises = [
        userBatcher.get('user-1'),
        userBatcher.get('user-1'),
        userBatcher.get('user-1'),
        userBatcher.get('user-2'),
        userBatcher.get('user-2'),
        userBatcher.get('user-3'),
      ];
      await Promise.all(promises);
      isRunning = false;
    },
  },
  {
    name: 'Multi-Batcher',
    description: 'Users + posts simultaneously',
    action: async () => {
      if (!userBatcher || !postBatcher) return;
      isRunning = true;
      const userPromises = [
        userBatcher.get('user-1'),
        userBatcher.get('user-2'),
        userBatcher.get('user-3'),
      ];
      const postPromises = [
        postBatcher.get('post-1'),
        postBatcher.get('post-2'),
        postBatcher.get('post-3'),
      ];
      await Promise.all([...userPromises, ...postPromises]);
      isRunning = false;
    },
  },
  {
    name: 'Slow API',
    description: '1.5s delay simulation',
    action: async () => {
      if (!slowBatcher) return;
      isRunning = true;
      const promises = [
        slowBatcher.get('item-1'),
        slowBatcher.get('item-2'),
        slowBatcher.get('item-3'),
      ];
      await Promise.all(promises);
      isRunning = false;
    },
  },
  {
    name: 'Cascade',
    description: 'Load users, then posts',
    action: async () => {
      if (!userBatcher || !postBatcher) return;
      isRunning = true;
      const users = await Promise.all([
        userBatcher.get('user-1'),
        userBatcher.get('user-2'),
      ]);
      const postPromises = users.flatMap((user) => [
        postBatcher!.get(`post-${user.id}-1`),
        postBatcher!.get(`post-${user.id}-2`),
      ]);
      await Promise.all(postPromises);
      isRunning = false;
    },
  },
  {
    name: 'Stress Test',
    description: '50 requests across batchers',
    action: async () => {
      if (!userBatcher || !postBatcher || !slowBatcher) return;
      isRunning = true;
      const promises = [];
      for (let i = 1; i <= 20; i++) {
        promises.push(userBatcher.get(`user-${i}`));
      }
      for (let i = 1; i <= 20; i++) {
        promises.push(postBatcher.get(`post-${i}`));
      }
      for (let i = 1; i <= 10; i++) {
        promises.push(slowBatcher.get(`slow-${i}`));
      }
      await Promise.all(promises);
      isRunning = false;
    },
  },
];
</script>

<div class="bg-stone-900 flex flex-col h-full">
  <div class="px-3 py-2 border-b border-stone-700">
    <h3 class="text-xs uppercase tracking-wider text-stone-500 font-mono">Presets</h3>
  </div>
  
  <div class="flex-1 overflow-y-auto">
    {#each presets as preset}
      <button
        onclick={preset.action}
        disabled={isRunning}
        class="w-full text-left px-3 py-2 border-b border-stone-800 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <div class="text-sm font-mono text-stone-100">{preset.name}</div>
        <div class="text-xs font-mono text-stone-500 mt-0.5">{preset.description}</div>
      </button>
    {/each}
  </div>
  
  <div class="px-3 py-2 border-t border-stone-700">
    <div class="text-xs font-mono text-stone-600">
      <span class="text-stone-500">Batchers:</span> users, posts, slow-api
    </div>
  </div>
</div>

