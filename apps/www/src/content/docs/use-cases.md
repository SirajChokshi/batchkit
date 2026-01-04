---
title: Patterns
description: Real-world examples
order: 3
---

# Patterns

## Database Queries

Avoid N+1 queries by batching database requests.

### Prisma

```typescript
const posts = batch(
  (authorIds) => prisma.post.findMany({ 
    where: { authorId: { in: authorIds } } 
  }),
  'authorId'
)
```

### Drizzle

```typescript
import { inArray } from 'drizzle-orm'

const users = batch(
  (ids) => 
    db.select()
      .from(usersTable)
      .where(inArray(usersTable.id, ids)),
  'id'
)
```

### Raw SQL

```typescript
const users = batch(async (ids) => {
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db.query(
    `SELECT * FROM users WHERE id IN (${placeholders})`,
    ids
  )
  return rows
}, 'id')
```

## React Components

When rendering a list of components that each fetch their own data, batching prevents a flood of requests.

```typescript
import { batch } from 'batchkit'
import { useQuery } from '@tanstack/react-query'

// Create batcher outside components (singleton)
const users = batch(
  (ids, signal) => 
    fetch(`/api/users?ids=${ids.join(',')}`, { signal })
      .then(r => r.json()),
  'id'
)

function UserCard({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: ({ signal }) => users.get(userId, { signal })
  })

  if (isLoading) return <Skeleton />
  return <Card user={data} />
}

function UserList({ userIds }: { userIds: string[] }) {
  return (
    <div>
      {userIds.map(id => <UserCard key={id} userId={id} />)}
    </div>
  )
}
```

Rendering 100 cards makes one HTTP request.

### Async State Libraries (React Query)

Batchkit handles batching only. For caching, combine with Tanstack Query, SWR, or RTK Query. These tools handle async state and batchkit schedules requests. They compose naturally.

## Rate-Limited APIs

When your API has batch size limits:

```typescript
const products = batch(
  (ids) => shopify.products.list({ ids }),
  'id',
  { max: 50 }  // Shopify's limit
)

// Requesting 200 products makes 4 sequential API calls
const items = await products.get(allProductIds)
```

## Wrapping Caches

Wrap single-threaded caches (like Redis) to batch requests and save round-trips.

```typescript
import { batch, indexed } from 'batchkit'

const getFlag = batch(async (names) => {
  const values = await redis.mget(names.map(n => `flag:${n}`))
  return Object.fromEntries(
    names.map((name, i) => [name, values[i] === '1'])
  )
}, indexed)

// Multiple checks → single MGET
const [checkoutUpsell, freeShippingPromo] = await Promise.all([
  getFlag.get('checkout_upsell'),
  getFlag.get('free_shipping_promo')
])

if (checkoutUpsell) {
  // route to interstitial page
}
```
