import { describe, expect, it, vi } from 'vitest';
import type { BanDef } from '@banwars/shared';
import catalogFile from '../../../data/catalog.json' with { type: 'json' };
import { DEFAULT_SETTINGS, PartyManager } from './party-manager.js';

const catalog = catalogFile.bans as BanDef[];

describe('PartyManager accumulated bans', () => {
  it('uses the longer default voting timer', () => {
    expect(DEFAULT_SETTINGS.voteSeconds).toBe(60);
  });

  it('increments the winning team total as soon as the host reports the result', () => {
    const manager = new PartyManager(catalog, {
      state: vi.fn(),
      event: vi.fn(),
      to: vi.fn(),
    });
    const created = manager.create('Host', 'free', 'host-socket');
    if (!created.ok) throw new Error(created.error);

    expect(manager.snapshot(created.code)?.wins).toEqual({ A: 0, B: 0 });
    expect(manager.startMatch(created.code, created.playerId).ok).toBe(true);
    expect(manager.reportResult(created.code, created.playerId, 'B').ok).toBe(true);
    expect(manager.snapshot(created.code)?.wins).toEqual({ A: 0, B: 1 });
    expect(manager.snapshot(created.code)?.lastResult).toEqual({ winner: 'B', score: null, mercy: false });

    expect(manager.reportResult(created.code, created.playerId, 'A', [0, 0]).ok).toBe(false);
    expect(manager.snapshot(created.code)?.wins).toEqual({ A: 0, B: 1 });
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

  it('keeps the free premium-ban selection stable across matches in a party game', () => {
    const manager = new PartyManager(catalog, {
      state: vi.fn(),
      event: vi.fn(),
      to: vi.fn(),
    });
    const created = manager.create('Host', 'free', 'host-socket');
    if (!created.ok) throw new Error(created.error);
    const premiumIds = new Set(catalog.filter((ban) => ban.premium).map((ban) => ban.id));

    const playRound = () => {
      expect(manager.startMatch(created.code, created.playerId).ok).toBe(true);
      expect(manager.reportResult(created.code, created.playerId, 'A', [1, 0]).ok).toBe(true);
      const availableBanIds = manager.snapshot(created.code)?.vote?.availableBanIds;
      if (!availableBanIds) throw new Error('Expected a vote pool for the active match');
      const nonPremiumBanId = availableBanIds.find((id) => !premiumIds.has(id));
      if (!nonPremiumBanId) throw new Error('Expected a non-premium ban in the vote pool');
      expect(manager.castVote(created.code, created.playerId, nonPremiumBanId).ok).toBe(true);
      return availableBanIds;
    };

    const firstMatchPool = playRound();
    const secondMatchPool = playRound();

    expect(secondMatchPool?.filter((id) => premiumIds.has(id))).toEqual(firstMatchPool?.filter((id) => premiumIds.has(id)));
  });

  it('removes applied bans from later vote options and rejects duplicate selections', () => {
    const manager = new PartyManager(catalog, {
      state: vi.fn(),
      event: vi.fn(),
      to: vi.fn(),
    });
    const created = manager.create('Host', 'premium', 'host-socket');
    if (!created.ok) throw new Error(created.error);

    const finishMatchWithBan = (banId: string) => {
      expect(manager.startMatch(created.code, created.playerId).ok).toBe(true);
      expect(manager.reportResult(created.code, created.playerId, 'A', [1, 0]).ok).toBe(true);
      const vote = manager.snapshot(created.code)?.vote;
      if (!vote) throw new Error('Expected an active vote');
      expect(vote.bannedBanIds.includes(banId)).toBe(true);
      expect(vote.availableBanIds.includes(banId)).toBe(false);
      expect(manager.castVote(created.code, created.playerId, banId)).toEqual({
        ok: false,
        error: 'That ban is already applied or not available this game',
      });
      expect(manager.castVote(created.code, created.playerId, vote.availableBanIds[0]).ok).toBe(true);
    };

    const firstBanId = 'op-no-shields';
    expect(manager.startMatch(created.code, created.playerId).ok).toBe(true);
    expect(manager.reportResult(created.code, created.playerId, 'A', [1, 0]).ok).toBe(true);
    expect(manager.castVote(created.code, created.playerId, firstBanId).ok).toBe(true);

    finishMatchWithBan(firstBanId);
    expect(manager.snapshot(created.code)?.bans.B.map((ban) => ban.id)).toContain(firstBanId);
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
