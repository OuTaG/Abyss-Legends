import type { StatKey, Stats } from './types';

export function addStats(target: Stats, src: Stats, times = 1): Stats {
  for (const k of Object.keys(src) as StatKey[]) {
    target[k] = (target[k] ?? 0) + (src[k] ?? 0) * times;
  }
  return target;
}

export const stat = (s: Stats, k: StatKey): number => s[k] ?? 0;
