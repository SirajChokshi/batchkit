---
title: Patterns
description: Real-world examples
order: 3
---

# Patterns

## Database Queries

### Prisma

```typescript
const users = batch(
  (ids) => prisma.user.findMany({ where: { id: { in: ids } } }),
  'id'
)

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
  (ids) => db.select().from(usersTable).where(inArray(usersTable.id, ids)),
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

## Caching Layer

batchkit handles batching only. For caching, use React Query or SWR:

```typescript
const users = batch(
  (ids, signal) => fetch(`/api/users?ids=${ids}`, { signal }).then(r => r.json()),
  'id'
)

function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: ({ signal }) => users.get(id, { signal }),
    staleTime: 5 * 60 * 1000,
  })
}
```

React Query caches results. batchkit batches requests. They compose naturally.

## Object Responses

Some APIs return objects keyed by ID instead of arrays:

```json
{
  "user-1": { "id": "user-1", "name": "Alice" },
  "user-2": { "id": "user-2", "name": "Bob" }
}
```

Use `indexed` to match by object key:

```typescript
import { batch, indexed } from 'batchkit'

const users = batch(
  async (ids) => {
    const res = await fetch(`/api/users?ids=${ids.join(',')}`)
    return res.json()
  },
  indexed
)
```
