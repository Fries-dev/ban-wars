import { describe, expect, it } from 'vitest';
import type { BanDef } from '@banwars/shared';
import { allowedPool, isMercy, tallyVotes } from './ban-engine.js';
import catalogFile from '../../../data/catalog.json' with { type: 'json' };

const catalog = catalogFile.bans as BanDef[];
const freeIds = allowedPool(catalog, 'free', 'test-party').map((b) => b.id);

describe('catalog', () => {
  it('has unique ids', () => expect(new Set(catalog.map((b) => b.id)).size).toBe(catalog.length));
  it('free tier still has operator and sight bans', () => {
    const cats = new Set(allowedPool(catalog, 'free', 'test-party').map((b) => b.category));
    expect(cats.has('operator')).toBe(true);
    expect(cats.has('sights')).toBe(true);
  });
  it('premium sees everything, free does not', () => {
    expect(allowedPool(catalog, 'premium', 'test-party').length).toBe(catalog.length);
    expect(freeIds.length).toBeLessThan(catalog.length);
  });
  it('operator catalog contains only image-free archetype bans', () => {
    const operatorBans = catalog.filter((b) => b.category === 'operator');
    expect(operatorBans.map((b) => b.label)).toEqual([
      'No Intel Ops',
      'No Shield Ops',
      'No Trap Ops',
      'No Hard-Breach Ops',
      'No Anti-Gadget Ops',
      'No Roamers',
      'No Anchors',
      'No Healers',
      'No Area-Denial Ops',
    ]);
    expect(operatorBans.every((b) => b.operatorImages && b.operatorImages.length > 0)).toBe(true);
    expect(catalog.every((b) => !('img' in b))).toBe(true);
  });
  it('keeps the same three seeded premium bans for the whole party game', () => {
    const premiumIds = catalog.filter((b) => b.premium).map((b) => b.id);
    const allowed = allowedPool(catalog, 'free', 'rotation-test');
    const featured = allowed.filter((ban) => ban.premium).map((ban) => ban.id);

    expect(featured).toHaveLength(3);
    expect(featured.every((id) => premiumIds.includes(id))).toBe(true);
    expect(allowed).toEqual(allowedPool(catalog, 'free', 'rotation-test'));
  });
});

describe('isMercy', () => {
  it('triggers on 7-0 only with default margin', () => {
    expect(isMercy([7, 0], 'A', 7)).toBe(true);
    expect(isMercy([7, 1], 'A', 7)).toBe(false);
    expect(isMercy([0, 7], 'B', 7)).toBe(true);
  });
});

describe('tallyVotes', () => {
  it('majority wins', () => expect(tallyVotes(['a', 'b', 'b'], 's', freeIds)).toBe('b'));
  it('tie is deterministic and one of the tied bans', () => {
    const r = tallyVotes(['a', 'b'], 'tie', freeIds);
    expect(['a', 'b']).toContain(r);
    expect(tallyVotes(['a', 'b'], 'tie', freeIds)).toBe(r);
  });
  it('no votes picks a random allowed ban, same every time for a seed', () => {
    const r = tallyVotes([], 'x', freeIds);
    expect(freeIds).toContain(r);
    expect(tallyVotes([], 'x', freeIds)).toBe(r);
  });
});
