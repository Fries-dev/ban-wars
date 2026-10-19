import { randomBytes, randomUUID } from 'node:crypto';
import { allowedPool, isMercy, tallyVotes } from './ban-engine.js';
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I
const CAP = { free: 5, premium: 10 };
const MAX_SPECTATORS = 20;
const GRACE_MS = 60_000; // rejoin window after crash / disconnect
export const DEFAULT_SETTINGS = { mercyMargin: 7, voteSeconds: 60 };
const fail = (error) => ({ ok: false, error });
const other = (t) => (t === 'A' ? 'B' : 'A');
export class PartyManager {
    catalog;
    out;
    parties = new Map();
    bySock = new Map();
    constructor(catalog, out) {
        this.catalog = catalog;
        this.out = out;
    }
    ctx(socketId) { return this.bySock.get(socketId) ?? null; }
    newCode() {
        for (;;) {
            const c = 'BW-' + Array.from(randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');
            if (!this.parties.has(c))
                return c;
        }
    }
    clean = (nick) => nick.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);
    view(p) {
        const eligible = [...p.players.values()].filter((x) => x.role === 'player' && x.team === p.vote?.winner).length;
        return {
            code: p.code, hostId: p.hostId, tier: p.tier, settings: p.settings, phase: p.phase,
            matchNo: p.matchNo, bans: p.bans, mercyTeam: p.mercyTeam, lastResult: p.lastResult,
            history: p.history,
            players: [...p.players.values()].map((x) => ({
                id: x.id, nick: x.nick, team: x.team, role: x.role, connected: x.socketId !== null, ready: x.ready,
            })),
            vote: p.vote && {
                winner: p.vote.winner, catalog: this.catalog,
                availableBanIds: allowedPool(this.catalog, p.tier, p.seed, p.matchNo).map((b) => b.id),
                deadline: p.vote.deadline,
                tally: [...p.vote.ballots.values()].reduce((t, id) => ({ ...t, [id]: (t[id] ?? 0) + 1 }), {}),
                votesIn: p.vote.ballots.size, votesNeeded: eligible,
            },
            serverNow: Date.now(),
        };
    }
    push(p) { this.out.state(p.code, this.view(p)); }
    // ---- lifecycle -------------------------------------------------------
    create(nick, tier, socketId) {
        const n = this.clean(nick);
        if (!n)
            return fail('Nickname required');
        const host = { id: randomUUID(), token: randomUUID(), nick: n, team: 'A', role: 'player', socketId, ready: false };
        const party = {
            code: this.newCode(), hostId: host.id, tier, settings: { ...DEFAULT_SETTINGS },
            seed: randomUUID(), players: new Map([[host.id, host]]), phase: 'lobby', matchNo: 0,
            bans: { A: [], B: [] }, mercyTeam: null, lastResult: null, history: [], vote: null,
        };
        this.parties.set(party.code, party);
        this.bySock.set(socketId, { code: party.code, playerId: host.id });
        this.push(party);
        return { ok: true, code: party.code, playerId: host.id, token: host.token };
    }
    join(code, nick, token, socketId) {
        const p = this.parties.get(code.toUpperCase().trim());
        if (!p)
            return fail('Party not found');
        let rec = token ? [...p.players.values()].find((x) => x.token === token) : undefined;
        if (rec) {
            if (rec.socketId)
                this.bySock.delete(rec.socketId);
            rec.socketId = socketId; // rejoin after crash
        }
        else {
            const n = this.clean(nick);
            if (!n)
                return fail('Nickname required');
            const seated = [...p.players.values()].filter((x) => x.role === 'player').length;
            const full = seated >= CAP[p.tier];
            if (full && p.players.size >= CAP[p.tier] + MAX_SPECTATORS)
                return fail('Party and spectator list are full');
            rec = { id: randomUUID(), token: randomUUID(), nick: n, team: null, role: full ? 'spectator' : 'player', socketId, ready: false };
            p.players.set(rec.id, rec);
            if (full)
                this.out.to(p.players.get(p.hostId).socketId ?? '', 'toast', { message: `Party limit reached (${CAP[p.tier]}). ${n} joined as spectator.` });
        }
        this.bySock.set(socketId, { code: p.code, playerId: rec.id });
        this.push(p);
        return { ok: true, code: p.code, playerId: rec.id, token: rec.token, role: rec.role };
    }
    disconnect(socketId) {
        const c = this.bySock.get(socketId);
        this.bySock.delete(socketId);
        const p = c && this.parties.get(c.code);
        const rec = p && p.players.get(c.playerId);
        if (!p || !rec)
            return;
        rec.socketId = null;
        this.push(p);
        clearTimeout(p.sweep);
        p.sweep = setTimeout(() => this.sweepParty(p), GRACE_MS);
    }
    sweepParty(p) {
        const live = [...p.players.values()].filter((x) => x.socketId);
        if (!live.length) {
            clearTimeout(p.vote?.timer);
            this.parties.delete(p.code);
            return;
        } // ephemeral
        if (!p.players.get(p.hostId)?.socketId) {
            p.hostId = live[0].id;
            this.push(p);
        } // host migration
    }
    snapshot(code) {
        const p = this.parties.get(code);
        return p ? this.view(p) : null;
    }
    leave(code, playerId, socketId) {
        const p = this.parties.get(code);
        this.bySock.delete(socketId);
        if (!p || !p.players.delete(playerId))
            return;
        if (!p.players.size) {
            clearTimeout(p.vote?.timer);
            clearTimeout(p.sweep);
            this.parties.delete(code);
            return;
        }
        if (p.hostId === playerId) {
            const next = [...p.players.values()].find((x) => x.socketId) ?? [...p.players.values()][0];
            p.hostId = next.id;
        }
        this.push(p);
    }
    // ---- host actions ----------------------------------------------------
    host(code, playerId) {
        const p = this.parties.get(code);
        if (!p)
            return fail('Party not found');
        if (p.hostId !== playerId)
            return fail('Host only');
        return { ok: true, p };
    }
    setTeam(code, playerId, team) {
        const p = this.parties.get(code);
        const rec = p?.players.get(playerId);
        if (!p || !rec)
            return fail('Not in party');
        if (p.phase !== 'lobby')
            return fail('Teams are locked during a match');
        if (rec.role === 'spectator')
            return fail('Spectators cannot join a team');
        rec.team = team;
        rec.ready = false;
        this.push(p);
        return { ok: true };
    }
    setReady(code, playerId, ready) {
        const p = this.parties.get(code);
        const rec = p?.players.get(playerId);
        if (!p || !rec)
            return fail('Not in party');
        if (p.phase !== 'lobby')
            return fail('Ready status can only change in the lobby');
        if (rec.role !== 'player' || !rec.team)
            return fail('Join a team before marking ready');
        if (typeof ready !== 'boolean')
            return fail('Invalid ready status');
        rec.ready = ready;
        this.push(p);
        return { ok: true };
    }
    kick(code, playerId, targetId) {
        const h = this.host(code, playerId);
        if (!h.ok)
            return h;
        const t = h.p.players.get(targetId);
        if (!t || t.id === playerId)
            return fail('Invalid target');
        if (t.socketId) {
            this.out.to(t.socketId, 'party:kicked', {});
            this.bySock.delete(t.socketId);
        }
        h.p.players.delete(targetId);
        this.push(h.p);
        return { ok: true };
    }
    setSettings(code, playerId, s) {
        const h = this.host(code, playerId);
        if (!h.ok)
            return h;
        const n = { ...h.p.settings };
        if (s.mercyMargin !== undefined)
            n.mercyMargin = Math.min(13, Math.max(1, Math.round(s.mercyMargin)));
        if (s.voteSeconds !== undefined)
            n.voteSeconds = Math.min(60, Math.max(5, Math.round(s.voteSeconds)));
        // PREMIUM HOOK: custom rule builder / workshop packs gate on h.p.tier === 'premium' here.
        h.p.settings = n;
        this.push(h.p);
        return { ok: true };
    }
    reset(code, playerId) {
        const h = this.host(code, playerId);
        if (!h.ok)
            return h;
        const p = h.p;
        clearTimeout(p.vote?.timer);
        Object.assign(p, { vote: null, phase: 'lobby', matchNo: 0, mercyTeam: null, lastResult: null,
            bans: { A: [], B: [] }, seed: randomUUID() });
        this.push(p);
        return { ok: true };
    }
    startMatch(code, playerId) {
        const h = this.host(code, playerId);
        if (!h.ok)
            return h;
        if (h.p.phase === 'voting')
            return fail('Wait for the ban vote to finish');
        h.p.players.forEach((player) => { player.ready = false; });
        h.p.phase = 'inMatch';
        this.push(h.p);
        return { ok: true };
    }
    /** Called by host (manual) or by the stats-API poller once wired. */
    reportResult(code, playerId, winner, score) {
        const h = this.host(code, playerId);
        if (!h.ok)
            return h;
        const p = h.p;
        if (p.phase !== 'inMatch')
            return fail('No match in progress');
        if (!Array.isArray(score) || score.some((n) => !Number.isInteger(n) || n < 0 || n > 99))
            return fail('Bad score');
        const mercy = isMercy(score, winner, p.settings.mercyMargin);
        p.matchNo += 1;
        p.lastResult = { winner, score, mercy };
        p.mercyTeam = null;
        p.phase = 'voting';
        const deadline = Date.now() + p.settings.voteSeconds * 1000;
        p.vote = { winner, deadline, ballots: new Map(),
            timer: setTimeout(() => this.finalizeVote(p), p.settings.voteSeconds * 1000) };
        const voters = [...p.players.values()].filter((x) => x.role === 'player' && x.team === winner);
        if (!voters.length)
            this.finalizeVote(p);
        else
            this.push(p);
        return { ok: true };
    }
    castVote(code, playerId, banId) {
        const p = this.parties.get(code);
        const rec = p?.players.get(playerId);
        if (!p || !rec || !p.vote)
            return fail('No vote open');
        if (rec.role !== 'player' || rec.team !== p.vote.winner)
            return fail('Only the winning team votes');
        const pool = allowedPool(this.catalog, p.tier, p.seed, p.matchNo);
        if (!pool.some((b) => b.id === banId))
            return fail('That ban is not available this game');
        p.vote.ballots.set(playerId, banId);
        const need = [...p.players.values()].filter((x) => x.role === 'player' && x.team === p.vote.winner).length;
        if (p.vote.ballots.size >= need)
            this.finalizeVote(p);
        else
            this.push(p);
        return { ok: true };
    }
    finalizeVote(p) {
        const v = p.vote;
        if (!v)
            return;
        clearTimeout(v.timer);
        const pool = allowedPool(this.catalog, p.tier, p.seed, p.matchNo).map((b) => b.id);
        const id = tallyVotes([...v.ballots.values()], `${p.seed}:${p.matchNo}:pick`, pool);
        const loser = other(v.winner);
        const ban = this.catalog.find((b) => b.id === id);
        if (!ban)
            throw new Error(`Selected ban ${id} is missing from the catalog`);
        p.bans[loser] = [ban, ...p.bans[loser].filter((existing) => existing.id !== id)];
        p.mercyTeam = p.lastResult?.mercy ? loser : null;
        if (p.lastResult) {
            p.history.unshift({
                matchNo: p.matchNo,
                ...p.lastResult,
                score: [...p.lastResult.score],
                bannedTeam: loser,
                ban,
                completedAt: Date.now(),
            });
            p.history = p.history.slice(0, 20);
        }
        p.vote = null;
        p.phase = 'lobby';
        this.out.event(p.code, 'ban:applied', { team: loser, bans: [ban] });
        this.push(p);
    }
    /** Mercy rule: lopsided loss lets the losing team strike one ban. */
    mercyUnban(code, playerId, banId) {
        const p = this.parties.get(code);
        const rec = p?.players.get(playerId);
        if (!p || !rec)
            return fail('Not in party');
        if (!p.mercyTeam || rec.team !== p.mercyTeam)
            return fail('No mercy available');
        const ban = p.bans[p.mercyTeam].find((b) => b.id === banId);
        if (!ban)
            return fail('Ban not found');
        const team = p.mercyTeam;
        p.bans[team] = p.bans[team].filter((b) => b.id !== banId);
        p.mercyTeam = null;
        this.out.event(p.code, 'ban:removed', { team, ban });
        this.push(p);
        return { ok: true };
    }
}
