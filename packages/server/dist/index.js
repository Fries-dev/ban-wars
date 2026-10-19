import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { Server } from 'socket.io';
import { PartyManager } from './party-manager.js';
const catalogFile = JSON.parse(readFileSync(new URL('../../../data/catalog.json', import.meta.url), 'utf8'));
/** Stub: swap for a Stripe-backed lookup (webhook -> accounts table). Never trust client-sent tiers. */
const tierFor = (_accountToken) => 'free';
const http = createServer((req, res) => {
    if (req.url === '/catalog') { // remotely updatable catalog endpoint
        res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
        return res.end(JSON.stringify(catalogFile));
    }
    if (req.url === '/health') {
        res.writeHead(200);
        return res.end('ok');
    }
    res.writeHead(404).end();
});
const io = new Server(http, { cors: { origin: '*' } });
const pm = new PartyManager(catalogFile.bans, {
    state: (code, view) => io.to(code).emit('party:state', view),
    event: (code, name, payload) => io.to(code).emit(name, payload),
    to: (sid, name, payload) => {
        io.to(sid).emit(name, payload);
        if (name === 'party:kicked')
            io.sockets.sockets.get(sid)?.rooms.forEach((r) => r !== sid && io.sockets.sockets.get(sid)?.leave(r));
    },
});
io.on('connection', (socket) => {
    // Wraps handlers: resolves party/player from the socket, never from client-sent ids.
    const guard = (name, fn) => socket.on(name, (p, ack) => {
        const c = pm.ctx(socket.id);
        const r = c ? fn(c.code, c.playerId, p ?? {}) : { ok: false, error: 'Not in a party' };
        ack?.(r);
    });
    socket.on('party:create', (p, ack) => {
        const r = pm.create(p?.nick ?? '', tierFor(p?.accountToken), socket.id);
        if (r.ok) {
            socket.join(r.code);
            const v = pm.snapshot(r.code);
            if (v)
                socket.emit('party:state', v);
        }
        ack?.(r);
    });
    socket.on('party:join', (p, ack) => {
        const r = pm.join(p?.code ?? '', p?.nick ?? '', p?.token, socket.id);
        if (r.ok) {
            socket.join(r.code);
            const v = pm.snapshot(r.code);
            if (v)
                socket.emit('party:state', v);
        }
        ack?.(r);
    });
    socket.on('party:leave', (_p, ack) => {
        const c = pm.ctx(socket.id);
        if (c) {
            pm.leave(c.code, c.playerId, socket.id);
            socket.leave(c.code);
        }
        ack?.({ ok: true });
    });
    guard('party:setTeam', (c, id, p) => pm.setTeam(c, id, p.team));
    guard('party:setReady', (c, id, p) => pm.setReady(c, id, p.ready));
    guard('party:kick', (c, id, p) => pm.kick(c, id, p.playerId));
    guard('party:settings', (c, id, p) => pm.setSettings(c, id, p));
    guard('party:reset', (c, id) => pm.reset(c, id));
    guard('match:start', (c, id) => pm.startMatch(c, id));
    guard('match:result', (c, id, p) => pm.reportResult(c, id, p.winner, p.score));
    guard('vote:cast', (c, id, p) => pm.castVote(c, id, p.banId));
    guard('mercy:unban', (c, id, p) => pm.mercyUnban(c, id, p.banId));
    socket.on('disconnect', () => pm.disconnect(socket.id));
});
const port = Number(process.env.PORT ?? 3001);
http.listen(port, () => console.log(`Ban Wars server on :${port}`));
