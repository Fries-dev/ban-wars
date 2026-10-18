import { BrowserWindow, ipcMain } from 'electron';
import { io } from 'socket.io-client';
import type { PartyView } from '@banwars/shared';

/** The socket lives in the main process; both windows are just views fed over IPC. */
export function startSync(serverUrl: string, windows: () => BrowserWindow[]) {
  const socket = io(serverUrl, { reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5000 });
  let session: { code: string; nick: string; token: string; playerId: string } | null = null;
  let lastState: PartyView | null = null;
  const send = (ch: string, data: unknown) =>
    windows().forEach((w) => !w.isDestroyed() && w.webContents.send(ch, data));

  socket.on('party:state', (s: PartyView) => { lastState = s; send('party:state', s); });
  for (const name of ['ban:applied', 'ban:removed', 'toast', 'party:kicked'])
    socket.on(name, (payload: unknown) => {
      if (name === 'party:kicked') { session = null; lastState = null; send('bw:session', null); }
      send('party:event', { name, payload });
    });

  socket.on('connect', () => send('bw:conn', true));
  socket.on('disconnect', () => send('bw:conn', false));
  socket.on('connect_error', () => send('bw:conn', false));

  // Auto-rejoin with the saved token after reconnects (crash, wifi blip, server restart within grace window).
  socket.on('connect', () => {
    if (!session) return;
    socket.emit('party:join', { code: session.code, nick: session.nick, token: session.token },
      (r: { ok: boolean }) => { if (!r.ok) { session = null; lastState = null; send('bw:session', null); } });
  });

  ipcMain.handle('bw:emit', (_e, event: string, payload: Record<string, unknown>) =>
    new Promise((resolve) => {
      socket.timeout(5000).emit(event, payload, (err: unknown, r: any) => {
        if (err) return resolve({ ok: false, error: 'Cannot reach server. Is it running?' });
        if (event === 'party:leave') { session = null; lastState = null; send('bw:session', null); }
        if (r?.ok && (event === 'party:create' || event === 'party:join')) {
          session = { code: r.code, nick: String(payload.nick), token: r.token, playerId: r.playerId };
          send('bw:session', { code: r.code, playerId: r.playerId });
        }
        resolve(r);
      });
    }));
  ipcMain.handle('bw:getSession', () => session && { code: session.code, playerId: session.playerId });
  ipcMain.handle('bw:getConn', () => socket.connected);
  ipcMain.handle('bw:getState', () => lastState);
}
