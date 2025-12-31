/**
 * Symbol for indexed matching (Record responses).
 * Use this when your batch function returns an object keyed by the request key.
 *
 * @example
 * ```ts
 * const users = batch(
 *   async (ids) => {
 *     // Returns { "1": user1, "2": user2 }
 *     return fetchUsersAsRecord(ids)
 *   },
 *   indexed
 * )
 * ```
 */
export const indexed: unique symbol = Symbol('indexed');
