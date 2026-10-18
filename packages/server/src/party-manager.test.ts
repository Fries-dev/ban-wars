import { describe, expect, it, vi } from 'vitest';
import type { BanDef } from '@banwars/shared';
import catalogFile from '../../../data/catalog.json' with { type: 'json' };
import { PartyManager } from './party-manager.js';

const catalog = catalogFile.bans as BanDef[];

describe('PartyManager accumulated bans', () => {
  it('keeps bans from earlier rounds until the host resets the party', () => {
    const manager = new PartyManager(catalog, {
      state: vi.fn(),
      event: vi.fn(),
      to: vi.fn(),
    });
    const created = manager.create('Host', 'premium', 'host-socket');
    if (!created.ok) throw new Error(created.error);

    const joined = manager.join(created.code, 'Player', undefined, 'player-socket');
    if (!joined.ok) throw new Error(joined.error);
    expect(manager.setTeam(created.code, joined.playerId, 'B').ok).toBe(true);

    const playRoundAndApplyBan = (banId: string) => {
      expect(manager.startMatch(created.code, created.playerId).ok).toBe(true);
      expect(manager.reportResult(created.code, created.playerId, 'A', [1, 0]).ok).toBe(true);
      expect(manager.castVote(created.code, created.playerId, banId).ok).toBe(true);
    };

    playRoundAndApplyBan('op-no-shields');
    playRoundAndApplyBan('wp-secondary-only');

    expect(manager.snapshot(created.code)?.bans.B.map((ban) => ban.id)).toEqual([
      'wp-secondary-only',
      'op-no-shields',
    ]);

    expect(manager.reset(created.code, created.playerId).ok).toBe(true);
    expect(manager.snapshot(created.code)?.bans).toEqual({ A: [], B: [] });
  });
});
