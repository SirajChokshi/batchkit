# batchkit

Automatic batching for async operations.

## Installation

```bash
npm install batchkit
# or
bun add batchkit
```

## Quick Start

```typescript
import { batch } from 'batchkit'

const users = batch(
  (ids) => db.users.findMany({ where: { id: { in: ids } } }),
  'id'
)

// These calls are automatically batched into ONE database query
const [alice, bob] = await Promise.all([
  users.get(1),
  users.get(2),
])
```

That's it. Two arguments:
1. A function that fetches many items at once
2. The field to match results by

## API

### `batch(fn, match, options?)`

Creates a batcher.

```typescript
const users = batch(
  // The batch function - receives keys and an AbortSignal
  async (ids: number[], signal: AbortSignal) => {
    return api.getUsers(ids, { signal })
  },
  // How to match results - just the field name
  'id',
  // Optional configuration
  {
    wait: 10,       // ms to wait before dispatch (default: 0 = microtask)
    max: 100,       // max batch size
    name: 'users',  // for debugging
  }
)
```

### `batcher.get(key)` / `batcher.get(keys)`

Get one or many items:

```typescript
// Single item
const user = await users.get(1)

// Multiple items (batched together)
const [a, b] = await Promise.all([users.get(1), users.get(2)])

// Array syntax
const team = await users.get([1, 2, 3, 4, 5])
```

### `batcher.get(key, { signal })`

Cancel a request:

```typescript
const controller = new AbortController()
const user = await users.get(1, { signal: controller.signal })

// Later...
controller.abort() // Rejects with AbortError
```

### `batcher.flush()`

Execute pending batch immediately:

```typescript
users.get(1)
users.get(2)
await users.flush() // Don't wait for scheduler
```

### `batcher.abort()`

Abort the in-flight batch:

```typescript
users.abort() // All pending requests reject with AbortError
```

## Matching Results

### By Field Name (most common)

```typescript
batch(fn, 'id')
// Matches results where result.id === requestedKey
```

### For Record/Object Responses

```typescript
import { batch, indexed } from 'batchkit'

const users = batch(
  async (ids) => {
    // Returns { "1": {...}, "2": {...} }
    return fetchUsersAsRecord(ids)
  },
  indexed
)
```

### Custom Matching

```typescript
batch(
  fn,
  (results, key) => results.find(r => r.externalId === key)
)
```

## Scheduling

### Default: Microtask

Batches all calls within the same event loop tick:

```typescript
const users = batch(fn, 'id')

// All batched into ONE request
users.get(1)
users.get(2)
users.get(3)
```

### Delayed

Wait before dispatching:

```typescript
batch(fn, 'id', { wait: 10 }) // 10ms window
```

### Animation Frame

Sync with rendering:

```typescript
import { batch, onAnimationFrame } from 'batchkit'

batch(fn, 'id', { schedule: onAnimationFrame })
```

### Idle

Background/low-priority work:

```typescript
import { batch, onIdle } from 'batchkit'

batch(fn, 'id', { schedule: onIdle({ timeout: 100 }) })
```

## Deduplication

Duplicate keys in the same batch are automatically deduplicated:

```typescript
// Only ONE request for id=1
await Promise.all([
  users.get(1),
  users.get(1),
  users.get(1),
])
```

For complex keys, provide a key function:

```typescript
batch(fn, match, {
  key: (query) => query.id  // Dedupe by query.id
})
```

## Tracing

Debug batch behavior:

```typescript
batch(fn, 'id', {
  name: 'users',
  trace: (event) => {
    console.log(event.type, event)
    // 'get', 'schedule', 'dispatch', 'resolve', 'error', 'abort'
  }
})
```

## Examples

### React + TanStack Query

```typescript
import { batch } from 'batchkit'
import { useQuery } from '@tanstack/react-query'

const users = batch(
  (ids, signal) => fetch(`/api/users?ids=${ids.join(',')}`, { signal }).then(r => r.json()),
  'id'
)

function UserAvatar({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ['user', userId],
    queryFn: ({ signal }) => users.get(userId, { signal })
  })
  
  return <img src={data?.avatar} />
}

// Rendering 100 UserAvatars = 1 HTTP request
```

### API with Rate Limits

```typescript
const products = batch(
  (ids) => shopify.products.list({ ids }),
  'id',
  { max: 50 }  // Shopify's limit
)

// 200 product requests = 4 API calls (50 each)
```

## TypeScript

Full type inference:

```typescript
type User = { id: number; name: string }

const users = batch(
  async (ids: number[]): Promise<User[]> => fetchUsers(ids),
  'id'
)

const user = await users.get(1) // user: User
const many = await users.get([1, 2]) // many: User[]
```

## License

MIT
