import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startSync } from './sync';

const SERVER_URL = process.env.BW_SERVER ?? 'http://localhost:3001';
let overlay: BrowserWindow; let panel: BrowserWindow; let interactive = false;

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
  panel = new BrowserWindow({
    width: 380, height: 720, minWidth: 340, backgroundColor: '#4a4a4a', title: `Ban Wars v${app.getVersion()}`, autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: false },
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
  createOverlay(); createPanel();
  startSync(SERVER_URL, () => [overlay, panel]);
  globalShortcut.register('F10', toggleInteractive); // F10 toggles click-through (use borderless windowed in-game)

  ipcMain.handle('bw:displays', () =>
    screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Display ${i + 1} (${d.size.width}x${d.size.height})`, selected: d.id === gameDisplay().id })));
  ipcMain.handle('bw:setDisplay', (_e, id: number) => {
    writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), displayId: id }));
    overlay.setBounds(gameDisplay().bounds);
  });

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
