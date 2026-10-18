import { randomBytes, randomUUID } from 'node:crypto';
import type { BanDef, PartyView, Phase, Settings, TeamId, Tier } from '@banwars/shared';
import { allowedPool, isMercy, tallyVotes } from './ban-engine.js';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I
const CAP: Record<Tier, number> = { free: 5, premium: 10 };
const MAX_SPECTATORS = 20;
const GRACE_MS = 60_000; // rejoin window after crash / disconnect
export const DEFAULT_SETTINGS: Settings = { mercyMargin: 7, voteSeconds: 20 };

export type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A');

interface PlayerRec {
  id: string; token: string; nick: string; team: TeamId | null;
  role: 'player' | 'spectator'; socketId: string | null;
}
interface VoteState {
  winner: TeamId; deadline: number;
  ballots: Map<string, string>; timer: NodeJS.Timeout;
}
interface Party {
  code: string; hostId: string; tier: Tier; settings: Settings; seed: string;
  players: Map<string, PlayerRec>; phase: Phase; matchNo: number;
  bans: Record<TeamId, BanDef[]>; mercyTeam: TeamId | null;
  lastResult: PartyView['lastResult']; vote: VoteState | null; sweep?: NodeJS.Timeout;
}

export interface Emitter {
  state(code: string, view: PartyView): void;
  event(code: string, name: string, payload: unknown): void;
  to(socketId: string, name: string, payload: unknown): void;
}

export class PartyManager {
  private parties = new Map<string, Party>();
  private bySock = new Map<string, { code: string; playerId: string }>();

  constructor(private catalog: BanDef[], private out: Emitter) {}

  ctx(socketId: string) { return this.bySock.get(socketId) ?? null; }

  private newCode() {
    for (;;) {
      const c = 'BW-' + Array.from(randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');
      if (!this.parties.has(c)) return c;
    }
  }
  private clean = (nick: string) => nick.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);

  private view(p: Party): PartyView {
    const eligible = [...p.players.values()].filter((x) => x.role === 'player' && x.team === p.vote?.winner).length;
    return {
      code: p.code, hostId: p.hostId, tier: p.tier, settings: p.settings, phase: p.phase,
      matchNo: p.matchNo, bans: p.bans, mercyTeam: p.mercyTeam, lastResult: p.lastResult,
      players: [...p.players.values()].map((x) => ({
        id: x.id, nick: x.nick, team: x.team, role: x.role, connected: x.socketId !== null,
      })),
      vote: p.vote && {
        winner: p.vote.winner, catalog: this.catalog,
        availableBanIds: allowedPool(this.catalog, p.tier, p.seed, p.matchNo).map((b) => b.id),
        deadline: p.vote.deadline,
        tally: [...p.vote.ballots.values()].reduce<Record<string, number>>((t, id) => ({ ...t, [id]: (t[id] ?? 0) + 1 }), {}),
        votesIn: p.vote.ballots.size, votesNeeded: eligible,
      },
      serverNow: Date.now(),
    };
  }
  private push(p: Party) { this.out.state(p.code, this.view(p)); }

  // ---- lifecycle -------------------------------------------------------
  create(nick: string, tier: Tier, socketId: string): R<{ code: string; playerId: string; token: string }> {
    const n = this.clean(nick);
    if (!n) return fail('Nickname required');
    const host: PlayerRec = { id: randomUUID(), token: randomUUID(), nick: n, team: 'A', role: 'player', socketId };
    const party: Party = {
      code: this.newCode(), hostId: host.id, tier, settings: { ...DEFAULT_SETTINGS },
      seed: randomUUID(), players: new Map([[host.id, host]]), phase: 'lobby', matchNo: 0,
      bans: { A: [], B: [] }, mercyTeam: null, lastResult: null, vote: null,
    };
    this.parties.set(party.code, party);
    this.bySock.set(socketId, { code: party.code, playerId: host.id });
    this.push(party);
    return { ok: true, code: party.code, playerId: host.id, token: host.token };
  }

  join(code: string, nick: string, token: string | undefined, socketId: string): R<{ code: string; playerId: string; token: string; role: string }> {
    const p = this.parties.get(code.toUpperCase().trim());
    if (!p) return fail('Party not found');
    let rec = token ? [...p.players.values()].find((x) => x.token === token) : undefined;
    if (rec) {
      if (rec.socketId) this.bySock.delete(rec.socketId);
      rec.socketId = socketId; // rejoin after crash
    } else {
      const n = this.clean(nick);
      if (!n) return fail('Nickname required');
      const seated = [...p.players.values()].filter((x) => x.role === 'player').length;
      const full = seated >= CAP[p.tier];
      if (full && p.players.size >= CAP[p.tier] + MAX_SPECTATORS) return fail('Party and spectator list are full');
      rec = { id: randomUUID(), token: randomUUID(), nick: n, team: null, role: full ? 'spectator' : 'player', socketId };
      p.players.set(rec.id, rec);
      if (full) this.out.to(p.players.get(p.hostId)!.socketId ?? '', 'toast',
        { message: `Party limit reached (${CAP[p.tier]}). ${n} joined as spectator.` });
    }
    this.bySock.set(socketId, { code: p.code, playerId: rec.id });
    this.push(p);
    return { ok: true, code: p.code, playerId: rec.id, token: rec.token, role: rec.role };
  }

  disconnect(socketId: string) {
    const c = this.bySock.get(socketId);
    this.bySock.delete(socketId);
    const p = c && this.parties.get(c.code);
    const rec = p && p.players.get(c!.playerId);
    if (!p || !rec) return;
    rec.socketId = null;
    this.push(p);
    clearTimeout(p.sweep);
    p.sweep = setTimeout(() => this.sweepParty(p), GRACE_MS);
  }

  private sweepParty(p: Party) {
    const live = [...p.players.values()].filter((x) => x.socketId);
    if (!live.length) { clearTimeout(p.vote?.timer); this.parties.delete(p.code); return; } // ephemeral
    if (!p.players.get(p.hostId)?.socketId) { p.hostId = live[0].id; this.push(p); }       // host migration
  }

  snapshot(code: string): PartyView | null {
    const p = this.parties.get(code);
    return p ? this.view(p) : null;
  }

  leave(code: string, playerId: string, socketId: string) {
    const p = this.parties.get(code);
    this.bySock.delete(socketId);
    if (!p || !p.players.delete(playerId)) return;
    if (!p.players.size) { clearTimeout(p.vote?.timer); clearTimeout(p.sweep); this.parties.delete(code); return; }
    if (p.hostId === playerId) {
      const next = [...p.players.values()].find((x) => x.socketId) ?? [...p.players.values()][0];
      p.hostId = next.id;
    }
    this.push(p);
  }

  // ---- host actions ----------------------------------------------------
  private host(code: string, playerId: string): R<{ p: Party }> {
    const p = this.parties.get(code);
    if (!p) return fail('Party not found');
    if (p.hostId !== playerId) return fail('Host only');
    return { ok: true, p };
  }

  setTeam(code: string, playerId: string, team: TeamId): R {
    const p = this.parties.get(code); const rec = p?.players.get(playerId);
    if (!p || !rec) return fail('Not in party');
    if (p.phase !== 'lobby') return fail('Teams are locked during a match');
    if (rec.role === 'spectator') return fail('Spectators cannot join a team');
    rec.team = team; this.push(p); return { ok: true };
  }

  kick(code: string, playerId: string, targetId: string): R {
    const h = this.host(code, playerId); if (!h.ok) return h;
    const t = h.p.players.get(targetId);
    if (!t || t.id === playerId) return fail('Invalid target');
    if (t.socketId) { this.out.to(t.socketId, 'party:kicked', {}); this.bySock.delete(t.socketId); }
    h.p.players.delete(targetId); this.push(h.p); return { ok: true };
  }

  setSettings(code: string, playerId: string, s: Partial<Settings>): R {
    const h = this.host(code, playerId); if (!h.ok) return h;
    const n = { ...h.p.settings };
    if (s.mercyMargin !== undefined) n.mercyMargin = Math.min(13, Math.max(1, Math.round(s.mercyMargin)));
    if (s.voteSeconds !== undefined) n.voteSeconds = Math.min(60, Math.max(5, Math.round(s.voteSeconds)));
    // PREMIUM HOOK: custom rule builder / workshop packs gate on h.p.tier === 'premium' here.
    h.p.settings = n; this.push(h.p); return { ok: true };
  }

  reset(code: string, playerId: string): R {
    const h = this.host(code, playerId); if (!h.ok) return h;
    const p = h.p; clearTimeout(p.vote?.timer);
    Object.assign(p, { vote: null, phase: 'lobby' as Phase, matchNo: 0, mercyTeam: null, lastResult: null,
      bans: { A: [], B: [] }, seed: randomUUID() });
    this.push(p); return { ok: true };
  }

  startMatch(code: string, playerId: string): R {
    const h = this.host(code, playerId); if (!h.ok) return h;
    if (h.p.phase === 'voting') return fail('Wait for the ban vote to finish');
    h.p.phase = 'inMatch'; this.push(h.p); return { ok: true };
  }

  /** Called by host (manual) or by the stats-API poller once wired. */
  reportResult(code: string, playerId: string, winner: TeamId, score: [number, number]): R {
    const h = this.host(code, playerId); if (!h.ok) return h;
    const p = h.p;
    if (p.phase !== 'inMatch') return fail('No match in progress');
    if (!Array.isArray(score) || score.some((n) => !Number.isInteger(n) || n < 0 || n > 99)) return fail('Bad score');
    const mercy = isMercy(score, winner, p.settings.mercyMargin);
    p.matchNo += 1;
    p.lastResult = { winner, score, mercy };
    p.mercyTeam = null;
    p.phase = 'voting';
    const deadline = Date.now() + p.settings.voteSeconds * 1000;
    p.vote = { winner, deadline, ballots: new Map(),
      timer: setTimeout(() => this.finalizeVote(p), p.settings.voteSeconds * 1000) };
    const voters = [...p.players.values()].filter((x) => x.role === 'player' && x.team === winner);
    if (!voters.length) this.finalizeVote(p); else this.push(p);
    return { ok: true };
  }

  castVote(code: string, playerId: string, banId: string): R {
    const p = this.parties.get(code); const rec = p?.players.get(playerId);
    if (!p || !rec || !p.vote) return fail('No vote open');
    if (rec.role !== 'player' || rec.team !== p.vote.winner) return fail('Only the winning team votes');
    const pool = allowedPool(this.catalog, p.tier, p.seed, p.matchNo);
    if (!pool.some((b) => b.id === banId)) return fail('That ban is not available this game');
    p.vote.ballots.set(playerId, banId);
    const need = [...p.players.values()].filter((x) => x.role === 'player' && x.team === p.vote!.winner).length;
    if (p.vote.ballots.size >= need) this.finalizeVote(p); else this.push(p);
    return { ok: true };
  }

  private finalizeVote(p: Party) {
    const v = p.vote; if (!v) return;
    clearTimeout(v.timer);
    const pool = allowedPool(this.catalog, p.tier, p.seed, p.matchNo).map((b) => b.id);
    const id = tallyVotes([...v.ballots.values()], `${p.seed}:${p.matchNo}:pick`, pool);
    const loser = other(v.winner);
    const ban = this.catalog.find((b) => b.id === id);
    if (!ban) throw new Error(`Selected ban ${id} is missing from the catalog`);
    p.bans[loser] = [ban, ...p.bans[loser].filter((existing) => existing.id !== id)];
    p.mercyTeam = p.lastResult?.mercy ? loser : null;
    p.vote = null; p.phase = 'lobby';
    this.out.event(p.code, 'ban:applied', { team: loser, bans: [ban] });
    this.push(p);
  }

  /** Mercy rule: lopsided loss lets the losing team strike one ban. */
  mercyUnban(code: string, playerId: string, banId: string): R {
    const p = this.parties.get(code); const rec = p?.players.get(playerId);
    if (!p || !rec) return fail('Not in party');
    if (!p.mercyTeam || rec.team !== p.mercyTeam) return fail('No mercy available');
    const ban = p.bans[p.mercyTeam].find((b) => b.id === banId);
    if (!ban) return fail('Ban not found');
    const team = p.mercyTeam;
    p.bans[team] = p.bans[team].filter((b) => b.id !== banId);
    p.mercyTeam = null;
    this.out.event(p.code, 'ban:removed', { team, ban });
    this.push(p); return { ok: true };
  }
}
