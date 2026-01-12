---
title: API Reference
description: Complete API documentation
order: 2
---

# API Reference

## batch()

Creates a batcher.

```typescript
function batch<K, V>(
  fn: (keys: K[], signal: AbortSignal) => Promise<V[] | Record<string, V>>,
  match: keyof V | typeof indexed | ((results: V[], key: K) => V | undefined),
  options?: BatchOptions
): Batcher<K, V>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `fn` | `(keys, signal) => Promise` | Batch function that fetches multiple items |
| `match` | `keyof V \| typeof indexed \| function` | How to match results to keys |
| `options` | `BatchOptions` | Optional configuration |

### BatchOptions

```typescript
interface BatchOptions {
  wait?: number           // ms to wait before dispatching (default: 0)
  max?: number            // Maximum batch size (default: unlimited)
  schedule?: Scheduler    // Custom scheduler
  name?: string           // Name for debugging
  trace?: TraceHandler    // Event handler for debugging
  key?: (k: K) => unknown // Custom key function for deduplication
}
```

## Batcher

The object returned by `batch()`.

### .get()

```typescript
get(key: K, options?: { signal?: AbortSignal }): Promise<V>
get(keys: K[], options?: { signal?: AbortSignal }): Promise<V[]>
```

Fetch one or more items. Requests in the same tick are batched together.

### .flush()

```typescript
flush(): Promise<void>
```

Dispatch pending requests immediately, bypassing the scheduler.

### .abort()

```typescript
abort(): void
```

Cancel all pending and in-flight requests. Rejects with `AbortError`. The signal passed to your batch function is also aborted.

### .name

```typescript
readonly name?: string
```

The name passed to `batch()`, if any.

## indexed

Symbol for matching object/record responses. This is the only supported symbol match.

```typescript
import { batch, indexed } from 'batchkit'

const users = batch(
  (ids) => fetchUsersAsObject(ids),  // Returns { "1": user1, "2": user2 }
  indexed
)
```

## Schedulers

### onAnimationFrame

```typescript
import { onAnimationFrame } from 'batchkit'

batch(fn, 'id', { schedule: onAnimationFrame })
```

Dispatches on the next animation frame. Syncs with browser rendering.

### onIdle

```typescript
import { onIdle } from 'batchkit'

batch(fn, 'id', { schedule: onIdle() })
batch(fn, 'id', { schedule: onIdle({ timeout: 100 }) })
```

Dispatches when the browser is idle. Falls back to `setTimeout` in non-browser environments.

### Custom Scheduler

```typescript
type Scheduler = (dispatch: () => void) => () => void
```

A scheduler receives a dispatch function and returns a cleanup function.

```typescript
const debounced: Scheduler = (dispatch) => {
  const id = setTimeout(dispatch, 100)
  return () => clearTimeout(id)
}

batch(fn, 'id', { schedule: debounced })
```

## TraceEvent

Events emitted when `trace` is provided.

```typescript
type TraceEvent =
  | { type: 'get'; key: K; timestamp: number }
  | { type: 'dedup'; key: K; timestamp: number }
  | { type: 'schedule'; batchId: string; size: number; timestamp: number }
  | { type: 'dispatch'; batchId: string; keys: K[]; timestamp: number }
  | { type: 'resolve'; batchId: string; duration: number; timestamp: number }
  | { type: 'error'; batchId: string; error: Error; timestamp: number }
  | { type: 'abort'; batchId: string; timestamp: number }
```

## BatchError

Thrown when batchkit encounters an error (e.g., no matching result for a key).

```typescript
import { BatchError } from 'batchkit'

try {
  await users.get(999)
} catch (e) {
  if (e instanceof BatchError) {
    // Handle batch-level error
  }
}
```

