import { describe, expect, it, vi } from 'vitest';
import type { BanDef } from '@banwars/shared';
import catalogFile from '../../../data/catalog.json' with { type: 'json' };
import { DEFAULT_SETTINGS, PartyManager } from './party-manager.js';

const catalog = catalogFile.bans as BanDef[];

describe('PartyManager accumulated bans', () => {
  it('uses the longer default voting timer', () => {
    expect(DEFAULT_SETTINGS.voteSeconds).toBe(60);
  });

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
    expect(manager.snapshot(created.code)?.history.map((match) => match.ban.id)).toEqual([
      'wp-secondary-only',
      'op-no-shields',
    ]);

    expect(manager.reset(created.code, created.playerId).ok).toBe(true);
    expect(manager.snapshot(created.code)?.bans).toEqual({ A: [], B: [] });
    expect(manager.snapshot(created.code)?.history).toHaveLength(2);
  });

  it('tracks lobby ready state and clears it when a match starts', () => {
    const manager = new PartyManager(catalog, {
      state: vi.fn(),
      event: vi.fn(),
      to: vi.fn(),
    });
    const created = manager.create('Host', 'free', 'host-socket');
    if (!created.ok) throw new Error(created.error);
    const joined = manager.join(created.code, 'Player', undefined, 'player-socket');
    if (!joined.ok) throw new Error(joined.error);

    expect(manager.setReady(created.code, joined.playerId, true)).toEqual({ ok: false, error: 'Join a team before marking ready' });
    expect(manager.setTeam(created.code, joined.playerId, 'B').ok).toBe(true);
    expect(manager.setReady(created.code, joined.playerId, true).ok).toBe(true);
    expect(manager.snapshot(created.code)?.players.find((player) => player.id === joined.playerId)?.ready).toBe(true);
    expect(manager.setReady(created.code, joined.playerId, false).ok).toBe(true);
    expect(manager.setReady(created.code, joined.playerId, true).ok).toBe(true);
    expect(manager.startMatch(created.code, created.playerId).ok).toBe(true);
    expect(manager.snapshot(created.code)?.players.find((player) => player.id === joined.playerId)?.ready).toBe(false);
    expect(manager.setReady(created.code, joined.playerId, true).ok).toBe(false);
  });
});
