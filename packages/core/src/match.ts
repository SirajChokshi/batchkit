import type { Match, MatchFn } from './types'
import { indexed } from './indexed'

// Re-export indexed
export { indexed }

/**
 * Type guard for indexed symbol.
 */
export function isIndexed<K, V>(match: Match<K, V>): match is symbol {
  return match === indexed
}

/**
 * Type guard for string key match.
 */
export function isKeyMatch<K, V>(match: Match<K, V>): match is keyof V {
  return typeof match === 'string'
}

/**
 * Normalize a Match to a function that works with array responses.
 * For indexed matching, this returns undefined - handle separately.
 */
export function normalizeMatch<K, V>(match: Match<K, V>): MatchFn<K, V> | null {
  if (isIndexed(match)) {
    // Indexed matching is handled separately
    return null
  }

  if (isKeyMatch<K, V>(match)) {
    const key = match
    return (results: V[], requestedKey: K) => {
      return results.find((item) => (item as Record<string, unknown>)[key as string] === requestedKey)
    }
  }

  // Already a function
  return match as MatchFn<K, V>
}

/**
 * Create a match function for indexed/Record responses.
 */
export function createIndexedMatcher<K, V>(): (results: Record<string, V>, key: K) => V | undefined {
  return (results, key) => results[String(key)]
}
