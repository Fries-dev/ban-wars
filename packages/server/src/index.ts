import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { Server } from 'socket.io';
import type { Ack, ClientEvents, Tier } from '@banwars/shared';
import { PartyManager, type R } from './party-manager.js';

const catalogFile = JSON.parse(readFileSync(new URL('../../../data/catalog.json', import.meta.url), 'utf8'));

/** Stub: swap for a Stripe-backed lookup (webhook -> accounts table). Never trust client-sent tiers. */
const tierFor = (_accountToken?: string): Tier => 'free';

const http = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/join') {
    const code = url.searchParams.get('code')?.toUpperCase() ?? '';
    if (!/^BW-[23456789A-HJ-NP-Z]{4}$/.test(code)) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
      return res.end('Invalid Ban Wars invite code.');
    }
    const appLink = `banwars://join?code=${code}`;
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    });
    return res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Join Ban Wars party ${code}</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#242424;color:#fff;font:16px "Segoe UI",Arial,sans-serif}
    main{max-width:440px;margin:24px;padding:32px;text-align:center;background:#383838;border-radius:16px}
    a{display:inline-block;margin:12px;padding:12px 20px;border-radius:8px;background:#d6953a;color:#fff;font-weight:700;text-decoration:none}
    p{color:#ddd;line-height:1.5}
  </style>
</head>
<body>
  <main>
    <h1>Join Ban Wars</h1>
    <p>Opening Ban Wars for party <strong>${code}</strong>…</p>
    <a href="${appLink}">Open Ban Wars</a>
    <p>If you don't have Ban Wars yet, <a href="https://github.com/Fries-dev/ban-wars/releases/latest">download it here</a>.</p>
  </main>
  <script>window.location.href=${JSON.stringify(appLink)};</script>
</body>
</html>`);
  }
  if (req.url === '/catalog') {                         // remotely updatable catalog endpoint
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify(catalogFile));
  }
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404).end();
});

const io = new Server(http, { cors: { origin: '*' } });

const pm = new PartyManager(catalogFile.bans, {
  state: (code, view) => io.to(code).emit('party:state', view),
  event: (code, name, payload) => io.to(code).emit(name, payload),
  to: (sid, name, payload) => {
    io.to(sid).emit(name, payload);
    if (name === 'party:kicked') io.sockets.sockets.get(sid)?.rooms.forEach((r) => r !== sid && io.sockets.sockets.get(sid)?.leave(r));
  },
});

io.on('connection', (socket) => {
  // Wraps handlers: resolves party/player from the socket, never from client-sent ids.
  const guard = <K extends keyof ClientEvents>(
    name: K,
    fn: (code: string, playerId: string, p: ClientEvents[K]) => R<object>,
  ) =>
    socket.on(name, (p: ClientEvents[K], ack?: Ack) => {
      const c = pm.ctx(socket.id);
      const r = c ? fn(c.code, c.playerId, p ?? ({} as ClientEvents[K])) : { ok: false as const, error: 'Not in a party' };
      ack?.(r as never);
    });

  socket.on('party:create', (p: ClientEvents['party:create'], ack?: Ack) => {
    const r = pm.create(p?.nick ?? '', tierFor(p?.accountToken), socket.id);
    if (r.ok) { socket.join(r.code); const v = pm.snapshot(r.code); if (v) socket.emit('party:state', v); }
    ack?.(r as never);
  });
  socket.on('party:join', (p: ClientEvents['party:join'], ack?: Ack) => {
    const r = pm.join(p?.code ?? '', p?.nick ?? '', p?.token, socket.id);
    if (r.ok) { socket.join(r.code); const v = pm.snapshot(r.code); if (v) socket.emit('party:state', v); }
    ack?.(r as never);
  });
  socket.on('party:leave', (_p: unknown, ack?: Ack) => {
    const c = pm.ctx(socket.id);
    if (c) { pm.leave(c.code, c.playerId, socket.id); socket.leave(c.code); }
    ack?.({ ok: true } as never);
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
