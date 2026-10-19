import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startSync } from './sync';

const SERVER_URL = process.env.BW_SERVER ?? 'http://localhost:3001';
let overlay: BrowserWindow; let panel: BrowserWindow; let interactive = false;
let pendingAuthCallback: string | null = null;
let pendingPartyCode: string | null = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function handleAuthCallback(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'banwars:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return;
    pendingAuthCallback = url;
    if (panel && !panel.isDestroyed()) panel.webContents.send('bw:auth-callback', url);
  } catch {
    console.warn('Ignoring invalid authentication callback URL');
  }
}

function handlePartyInvite(url: string) {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code')?.toUpperCase() ?? '';
    if (parsed.protocol !== 'banwars:' || parsed.hostname !== 'join' || !/^BW-[23456789A-HJ-NP-Z]{4}$/.test(code)) return;
    pendingPartyCode = code;
    if (panel && !panel.isDestroyed()) {
      panel.webContents.send('bw:party-invite', code);
      panel.show();
      panel.focus();
    }
  } catch {
    console.warn('Ignoring invalid party invite URL');
  }
}

function handleProtocolUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'banwars:') return;
    if (parsed.hostname === 'auth' && parsed.pathname === '/callback') handleAuthCallback(url);
    else if (parsed.hostname === 'join') handlePartyInvite(url);
  } catch {
    console.warn('Ignoring invalid Ban Wars URL');
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});
app.on('second-instance', (_event, commandLine) => {
  const protocolUrl = commandLine.find((arg) => arg.startsWith('banwars://'));
  if (protocolUrl) handleProtocolUrl(protocolUrl);
  if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); }
});

const settingsFile = () => join(app.getPath('userData'), 'settings.json');
const loadSettings = (): { displayId?: number } => { try { return JSON.parse(readFileSync(settingsFile(), 'utf8')); } catch { return {}; } };
const gameDisplay = () => screen.getAllDisplays().find((d) => d.id === loadSettings().displayId) ?? screen.getPrimaryDisplay();

function load(win: BrowserWindow, hash: string) {
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/${hash}`);
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${hash}` });
}

function createOverlay() {
  overlay = new BrowserWindow({
    ...gameDisplay().bounds, transparent: true, frame: false, resizable: false, hasShadow: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true }); // click-through by default
  load(overlay, 'overlay');
}

function createPanel() {
  const title = `Ban Wars v.${app.getVersion()}`;
  panel = new BrowserWindow({
    width: 380, height: 720, minWidth: 340, minHeight: 500, backgroundColor: '#4a4a4a', title,
    frame: false, resizable: false, fullscreenable: false, autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false },
  });
  panel.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    panel.setTitle(title);
  });
  load(panel, 'panel');
  panel.on('closed', () => app.quit());
}

function toggleInteractive() {
  interactive = !interactive;
  overlay.setIgnoreMouseEvents(!interactive, { forward: true });
  overlay.setFocusable(interactive);
  if (interactive) overlay.focus();
  overlay.webContents.send('bw:interactive', interactive);
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) {
    app.quit();
    return;
  }
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient('banwars', process.execPath, [app.getAppPath()]);
  } else {
    app.setAsDefaultProtocolClient('banwars');
  }
  createOverlay(); createPanel();
  startSync(SERVER_URL, () => [overlay, panel]);
  globalShortcut.register('F10', toggleInteractive); // F10 toggles click-through (use borderless windowed in-game)

  ipcMain.handle('bw:openAuthUrl', async (_event, value: string) => {
    let url: URL;
    try { url = new URL(value); } catch { return { ok: false, error: 'Invalid sign-in URL' }; }
    if (url.protocol !== 'https:' || url.pathname !== '/auth/v1/authorize' || !['google', 'apple'].includes(url.searchParams.get('provider') ?? '')) {
      return { ok: false, error: 'Unexpected sign-in URL' };
    }
    await shell.openExternal(url.toString());
    return { ok: true };
  });
  ipcMain.handle('bw:getAuthCallback', () => pendingAuthCallback);
  ipcMain.handle('bw:clearAuthCallback', (_event, url: string) => {
    if (pendingAuthCallback === url) pendingAuthCallback = null;
  });
  ipcMain.handle('bw:getPendingPartyCode', () => pendingPartyCode);
  ipcMain.handle('bw:clearPendingPartyCode', (_event, code: string) => {
    if (pendingPartyCode === code) pendingPartyCode = null;
  });
  ipcMain.handle('bw:copyText', (_event, text: unknown) => {
    if (typeof text !== 'string' || !text.trim()) throw new TypeError('Clipboard text must be a non-empty string');
    clipboard.writeText(text);
  });
  ipcMain.handle('bw:panelVersion', () => app.getVersion());
  ipcMain.handle('bw:panelControl', (event, action: unknown) => {
    if (event.sender !== panel.webContents) throw new Error('Panel window controls may only be used by the panel');
    if (action === 'minimize') panel.minimize();
    else if (action === 'close') panel.close();
    else throw new TypeError('Unknown panel window action');
  });
  ipcMain.handle('bw:resetOverlayPosition', () => {
    if (!overlay.isDestroyed()) overlay.webContents.send('bw:reset-overlay-position');
  });

  ipcMain.handle('bw:displays', () =>
    screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Display ${i + 1} (${d.size.width}x${d.size.height})`, selected: d.id === gameDisplay().id })));
  ipcMain.handle('bw:setDisplay', (_e, id: number) => {
    writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), displayId: id }));
    overlay.setBounds(gameDisplay().bounds);
  });

  const initialProtocolUrl = process.argv.find((arg) => arg.startsWith('banwars://'));
  if (initialProtocolUrl) handleProtocolUrl(initialProtocolUrl);

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (error) => console.error('Auto-update failed:', error));
    void autoUpdater.checkForUpdatesAndNotify().catch((error: Error) => {
      console.error('Auto-update check failed:', error);
    });
  }
});
app.on('will-quit', () => globalShortcut.unregisterAll());
