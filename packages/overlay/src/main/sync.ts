import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { io } from 'socket.io-client';
import type { PartyView, TeamId } from '@banwars/shared';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ScreenshotMatchSource, type MatchDetectionOptions } from './match-source';

/** The socket lives in the main process; both windows are just views fed over IPC. */
export function startSync(
  serverUrl: string,
  windows: () => BrowserWindow[],
  getDetectionSettings: () => Pick<MatchDetectionOptions, 'enabled' | 'displayId'>,
) {
  const socket = io(serverUrl, { reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5000 });
  const sessionFile = join(app.getPath('userData'), 'party-session.json');
  type Session = { code: string; nick: string; token: string; playerId: string };
  const loadSession = (): Session | null => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('Secure storage is unavailable; party rejoin will not persist across app restarts.');
        return null;
      }
      const encrypted = readFileSync(sessionFile, 'utf8');
      const value: unknown = JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, 'base64')));
      if (value && typeof value === 'object'
        && 'code' in value && typeof value.code === 'string'
        && 'nick' in value && typeof value.nick === 'string'
        && 'token' in value && typeof value.token === 'string'
        && 'playerId' in value && typeof value.playerId === 'string') {
        return { code: value.code, nick: value.nick, token: value.token, playerId: value.playerId };
      }
      if (value === null) return null;
      console.error('Saved party session is invalid and will not be reused.');
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        console.error('Could not read saved party session:', error);
      }
    }
    return null;
  };
  let session: Session | null = loadSession();
  let lastState: PartyView | null = null;
  const persistSession = (value: Session | null) => {
    session = value;
    try {
      if (value) {
        if (!safeStorage.isEncryptionAvailable()) {
          console.error('Secure storage is unavailable; party rejoin will not persist across app restarts.');
          return;
        }
        const encrypted = safeStorage.encryptString(JSON.stringify(value)).toString('base64');
        writeFileSync(sessionFile, encrypted, { mode: 0o600 });
      } else {
        unlinkSync(sessionFile);
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT' && value === null)) {
        console.error('Could not save party rejoin session:', error);
      }
    }
  };
  const send = (ch: string, data: unknown) =>
    windows().forEach((w) => !w.isDestroyed() && w.webContents.send(ch, data));

  const matchSource = new ScreenshotMatchSource((result) => new Promise((resolve) => {
    if (!socket.connected) {
      matchSource.setError('The server is offline. Automatic result reporting will retry when connected.');
      resolve(false);
      return;
    }
    socket.timeout(5000).emit('match:result', result, (error: unknown, response: { ok: boolean; error?: string }) => {
      if (error) {
        matchSource.setError('The server did not respond to the automatic result. Detection will retry.');
        resolve(false);
      } else if (!response.ok) {
        matchSource.setError(response.error ?? 'The server rejected the automatic result.');
        resolve(false);
      } else {
        resolve(true);
      }
    });
  }), (message) => send('bw:win-detection-error', message));
  const updateMatchDetection = () => {
    const settings = getDetectionSettings();
    const hostPlayer = lastState?.players.find((player) => player.id === session?.playerId);
    const activeHostMatch = !!session && socket.connected
      && lastState?.hostId === session.playerId && lastState.phase === 'inMatch';
    const team: TeamId | null = activeHostMatch ? hostPlayer?.team ?? null : null;
    matchSource.update({ ...settings, active: activeHostMatch, team });
  };

  socket.on('party:state', (s: PartyView) => {
    lastState = s;
    send('party:state', s);
    updateMatchDetection();
  });
  for (const name of ['ban:applied', 'ban:removed', 'toast', 'party:kicked'])
    socket.on(name, (payload: unknown) => {
      if (name === 'party:kicked') {
        persistSession(null);
        lastState = null;
        send('bw:session', null);
        updateMatchDetection();
      }
      send('party:event', { name, payload });
    });

  socket.on('connect', () => { send('bw:conn', true); updateMatchDetection(); });
  socket.on('disconnect', () => { send('bw:conn', false); updateMatchDetection(); });
  socket.on('connect_error', () => send('bw:conn', false));

  // Auto-rejoin with the saved token after reconnects (crash, wifi blip, server restart within grace window).
  socket.on('connect', () => {
    if (!session) return;
    socket.emit('party:join', { code: session.code, nick: session.nick, token: session.token },
      (r: { ok: boolean }) => {
        if (!r.ok) {
          persistSession(null);
          lastState = null;
          send('bw:session', null);
          updateMatchDetection();
        }
      });
  });

  ipcMain.handle('bw:emit', (_e, event: string, payload: Record<string, unknown>) =>
    new Promise((resolve) => {
      socket.timeout(5000).emit(event, payload, (err: unknown, r: any) => {
        if (err) return resolve({ ok: false, error: 'Cannot reach server. Is it running?' });
        if (event === 'party:leave') {
          persistSession(null);
          lastState = null;
          send('bw:session', null);
          updateMatchDetection();
        }
        if (r?.ok && (event === 'party:create' || event === 'party:join')) {
          persistSession({ code: r.code, nick: String(payload.nick), token: r.token, playerId: r.playerId });
          send('bw:session', { code: r.code, playerId: r.playerId });
          updateMatchDetection();
        }
        resolve(r);
      });
    }));
  ipcMain.handle('bw:getSession', () => session && { code: session.code, playerId: session.playerId });
  ipcMain.handle('bw:getConn', () => socket.connected);
  ipcMain.handle('bw:getState', () => lastState);
  app.on('will-quit', () => { void matchSource.stop(); });
  return updateMatchDetection;
}
