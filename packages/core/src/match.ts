import { BatchError } from './errors';
import { indexed } from './indexed';
import type { Match, MatchFn } from './types';

export function isIndexed<K, V>(match: Match<K, V>): match is typeof indexed {
  return match === indexed;
}

export function isKeyMatch<K, V>(match: Match<K, V>): match is keyof V {
  return typeof match === 'string' || typeof match === 'number';
}

export function normalizeMatch<K, V>(match: Match<K, V>): MatchFn<K, V> | null {
  if (isIndexed(match)) {
    // Indexed matching is handled separately
    return null;
  }

  if (typeof match === 'symbol') {
    throw new BatchError(
      'Unsupported symbol match. Use `indexed` for Record responses.',
    );
  }

  if (isKeyMatch<K, V>(match)) {
    const key = match as string | number;
    return (results: V[], requestedKey: K) => {
      return results.find(
        (item) =>
          (item as Record<string | number, unknown>)[key] === requestedKey,
      );
    };
  }

  // Already a function
  return match as MatchFn<K, V>;
}

export function createIndexedMatcher<K, V>(): (
  results: Record<string, V>,
  key: K,
) => V | undefined {
  return (results, key) => results[String(key)];
}
