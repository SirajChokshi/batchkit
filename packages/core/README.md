# batchkit

A modern TypeScript library for batching async operations. Solve the N+1 query problem with a simple, flexible API.

## Installation

```bash
bun add batchkit
# or
npm install batchkit
# or
pnpm add batchkit
```

## Quick Start

```typescript
import { createBatcher } from 'batchkit'

// Create a batcher for user lookups
const userLoader = createBatcher({
  resolver: async (ids: string[]) => {
    // This function receives ALL keys batched together
    const users = await db.users.findMany({ where: { id: { in: ids } } })
    // Return results in the same order as input keys
    return ids.map(id => users.find(u => u.id === id) ?? null)
  }
})

// Use it anywhere - calls are automatically batched!
const user = await userLoader.load('user-123')
const users = await userLoader.loadMany(['user-1', 'user-2'])
```

## Features

- **Automatic Batching**: Collects all calls within the same tick and batches them together
- **Deduplication**: Same key requested multiple times? Only fetched once
- **Flexible Scheduling**: Microtask (default), time window, or manual dispatch
- **Max Batch Size**: Split large batches to respect API limits
- **Caching**: Prime and clear values as needed
- **Observability**: Hooks for metrics and debugging
- **TypeScript First**: Full type safety and inference

## API

### `createBatcher(options)`

Creates a new batcher instance.

```typescript
const batcher = createBatcher({
  // Required: batch resolver function
  resolver: async (keys: K[]) => V[],
  
  // Optional: name for debugging
  name: 'users',
  
  // Optional: scheduling strategy
  scheduler: 'microtask' | 'manual' | windowScheduler({ wait: 10 }),
  
  // Optional: max keys per batch
  maxBatchSize: 100,
  
  // Optional: custom key function for deduplication
  keyFn: (key) => key.id,
  
  // Optional: observability hooks
  onBatch: (info) => console.log(`Batched ${info.size} items`),
  onError: (info) => console.error(info.error),
})
```

### Batcher Methods

```typescript
// Load a single value
const user = await batcher.load('user-123')

// Load multiple values
const users = await batcher.loadMany(['user-1', 'user-2'])

// Pre-populate the cache
batcher.prime('user-123', cachedUser)

// Clear cached values
batcher.clear('user-123')  // Single key
batcher.clearAll()         // All keys

// Manual dispatch (when using 'manual' scheduler)
await batcher.dispatch()
```

## Scheduling Strategies

### Microtask (Default)

Batches all calls within the same event loop tick. Best for most use cases.

```typescript
const batcher = createBatcher({
  resolver: async (keys) => fetchItems(keys),
  scheduler: 'microtask', // This is the default
})
```

### Window Scheduler

Batches calls within a time window. Useful when calls are spread over time.

```typescript
import { windowScheduler } from 'batchkit'

const batcher = createBatcher({
  resolver: async (keys) => fetchItems(keys),
  scheduler: windowScheduler({ wait: 50 }), // 50ms window
})
```

### Manual Scheduler

Only dispatches when you call `.dispatch()`. Full control over timing.

```typescript
const batcher = createBatcher({
  resolver: async (keys) => fetchItems(keys),
  scheduler: 'manual',
})

// Queue up requests
const promise1 = batcher.load('a')
const promise2 = batcher.load('b')

// Dispatch when ready
await batcher.dispatch()
```

## Observability

Track batch execution for debugging and metrics:

```typescript
const batcher = createBatcher({
  name: 'users',
  resolver: async (keys) => fetchUsers(keys),
  
  onBatch: (info) => {
    console.log(`[${info.name}] Batched ${info.size} keys in ${info.duration}ms`)
    // Send to your metrics system
    metrics.histogram('batch_size', info.size)
    metrics.timing('batch_duration', info.duration)
  },
  
  onError: (info) => {
    console.error(`[${info.name}] Batch failed:`, info.error)
    // Report to error tracking
    Sentry.captureException(info.error)
  },
})
```

## Error Handling

### Batch-Level Errors

If the resolver throws, all pending requests are rejected:

```typescript
const batcher = createBatcher({
  resolver: async (keys) => {
    throw new Error('Database connection failed')
  },
})

// All these will reject with "Database connection failed"
await Promise.allSettled([
  batcher.load('a'),
  batcher.load('b'),
])
```

### Per-Item Errors

Return `Error` instances for individual failures:

```typescript
const batcher = createBatcher({
  resolver: async (keys) => {
    return keys.map(key => {
      if (key === 'invalid') {
        return new Error('Not found')
      }
      return fetchItem(key)
    })
  },
})

// Only 'invalid' key will reject
const results = await Promise.allSettled([
  batcher.load('valid'),    // Resolves
  batcher.load('invalid'),  // Rejects with "Not found"
])
```

## Common Use Cases

### Database N+1 Problem

```typescript
// Without batching: 50 posts = 50 queries 😱
for (const post of posts) {
  post.author = await db.users.findUnique({ where: { id: post.authorId } })
}

// With batching: 50 posts = 1 query 🎉
const userLoader = createBatcher({
  resolver: async (ids) => {
    const users = await db.users.findMany({ where: { id: { in: ids } } })
    return ids.map(id => users.find(u => u.id === id))
  },
})

await Promise.all(posts.map(async post => {
  post.author = await userLoader.load(post.authorId)
}))
```

### API Request Batching

```typescript
const productLoader = createBatcher({
  resolver: async (productIds) => {
    const response = await fetch('/api/products/batch', {
      method: 'POST',
      body: JSON.stringify({ ids: productIds }),
    })
    return response.json()
  },
  maxBatchSize: 50, // API limit
})
```

### SQLite Local-First Apps

```typescript
const taskLoader = createBatcher({
  resolver: async (ids) => {
    const placeholders = ids.map(() => '?').join(',')
    return db.query(`SELECT * FROM tasks WHERE id IN (${placeholders})`, ids)
  },
  name: 'tasks',
  onBatch: (info) => {
    console.log(`Loaded ${info.size} tasks in ${info.duration.toFixed(2)}ms`)
  },
})
```

## License

MIT

