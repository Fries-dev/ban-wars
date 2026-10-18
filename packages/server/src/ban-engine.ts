import type { BanDef, Tier } from '@banwars/shared';

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const makeRng = (seed: string) => mulberry32(xmur3(seed)());

const FREE_PREMIUM_BANS_PER_MATCH = 3;

/** Bans a party of this tier is allowed to pick for a given match. */
export function allowedPool(catalog: BanDef[], tier: Tier, seed: string, matchNo: number): BanDef[] {
  if (tier === 'premium') return catalog;

  const premium = catalog.filter((b) => b.premium);
  if (premium.length <= FREE_PREMIUM_BANS_PER_MATCH) return catalog;

  const shuffled = [...premium];
  const rng = makeRng(`${seed}:premium-rotation`);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const start = (Math.max(0, matchNo - 1) * FREE_PREMIUM_BANS_PER_MATCH) % shuffled.length;
  const featured = new Set(Array.from({ length: FREE_PREMIUM_BANS_PER_MATCH },
    (_, i) => shuffled[(start + i) % shuffled.length].id));
  return catalog.filter((b) => !b.premium || featured.has(b.id));
}

export function isMercy(score: [number, number], winner: 'A' | 'B', margin: number): boolean {
  const [a, b] = score;
  const [w, l] = winner === 'A' ? [a, b] : [b, a];
  return w - l >= margin;
}

/**
 * Picks the single ban. Most votes wins; ties are broken by a seeded pick (deterministic);
 * if nobody voted, a seeded random ban from the allowed pool is used.
 */
export function tallyVotes(ballots: string[], seed: string, pool: string[]): string {
  if (!ballots.length) return pool[Math.floor(makeRng(seed)() * pool.length)];
  const counts = new Map<string, number>();
  for (const b of ballots) counts.set(b, (counts.get(b) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const tied = [...counts].filter(([, c]) => c === max).map(([id]) => id).sort();
  return tied.length === 1 ? tied[0] : tied[Math.floor(makeRng(seed)() * tied.length)];
}
