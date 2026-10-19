"use strict";
const electron = require("electron");
const electronUpdater = require("electron-updater");
const node_fs = require("node:fs");
const node_path = require("node:path");
const socket_ioClient = require("socket.io-client");
function startSync(serverUrl, windows) {
  const socket = socket_ioClient.io(serverUrl, { reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5e3 });
  const sessionFile = node_path.join(electron.app.getPath("userData"), "party-session.json");
  const loadSession = () => {
    try {
      if (!electron.safeStorage.isEncryptionAvailable()) {
        console.error("Secure storage is unavailable; party rejoin will not persist across app restarts.");
        return null;
      }
      const encrypted = node_fs.readFileSync(sessionFile, "utf8");
      const value = JSON.parse(electron.safeStorage.decryptString(Buffer.from(encrypted, "base64")));
      if (value && typeof value === "object" && "code" in value && typeof value.code === "string" && "nick" in value && typeof value.nick === "string" && "token" in value && typeof value.token === "string" && "playerId" in value && typeof value.playerId === "string") {
        return { code: value.code, nick: value.nick, token: value.token, playerId: value.playerId };
      }
      if (value === null) return null;
      console.error("Saved party session is invalid and will not be reused.");
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        console.error("Could not read saved party session:", error);
      }
    }
    return null;
  };
  let session = loadSession();
  let lastState = null;
  const persistSession = (value) => {
    session = value;
    try {
      if (value) {
        if (!electron.safeStorage.isEncryptionAvailable()) {
          console.error("Secure storage is unavailable; party rejoin will not persist across app restarts.");
          return;
        }
        const encrypted = electron.safeStorage.encryptString(JSON.stringify(value)).toString("base64");
        node_fs.writeFileSync(sessionFile, encrypted, { mode: 384 });
      } else {
        node_fs.unlinkSync(sessionFile);
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT" && value === null)) {
        console.error("Could not save party rejoin session:", error);
      }
    }
  };
  const send = (ch, data) => windows().forEach((w) => !w.isDestroyed() && w.webContents.send(ch, data));
  socket.on("party:state", (s) => {
    lastState = s;
    send("party:state", s);
  });
  for (const name of ["ban:applied", "ban:removed", "toast", "party:kicked"])
    socket.on(name, (payload) => {
      if (name === "party:kicked") {
        persistSession(null);
        lastState = null;
        send("bw:session", null);
      }
      send("party:event", { name, payload });
    });
  socket.on("connect", () => send("bw:conn", true));
  socket.on("disconnect", () => send("bw:conn", false));
  socket.on("connect_error", () => send("bw:conn", false));
  socket.on("connect", () => {
    if (!session) return;
    socket.emit(
      "party:join",
      { code: session.code, nick: session.nick, token: session.token },
      (r) => {
        if (!r.ok) {
          persistSession(null);
          lastState = null;
          send("bw:session", null);
        }
      }
    );
  });
  electron.ipcMain.handle("bw:emit", (_e, event, payload) => new Promise((resolve) => {
    socket.timeout(5e3).emit(event, payload, (err, r) => {
      if (err) return resolve({ ok: false, error: "Cannot reach server. Is it running?" });
      if (event === "party:leave") {
        persistSession(null);
        lastState = null;
        send("bw:session", null);
      }
      if (r?.ok && (event === "party:create" || event === "party:join")) {
        persistSession({ code: r.code, nick: String(payload.nick), token: r.token, playerId: r.playerId });
        send("bw:session", { code: r.code, playerId: r.playerId });
      }
      resolve(r);
    });
  }));
  electron.ipcMain.handle("bw:getSession", () => session && { code: session.code, playerId: session.playerId });
  electron.ipcMain.handle("bw:getConn", () => socket.connected);
  electron.ipcMain.handle("bw:getState", () => lastState);
}
const SERVER_URL = "https://ban-wars-test.up.railway.app";
let overlay;
let panel;
let interactive = false;
let pendingAuthCallback = null;
const hasSingleInstanceLock = electron.app.requestSingleInstanceLock();
function handleAuthCallback(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "banwars:" || parsed.hostname !== "auth" || parsed.pathname !== "/callback") return;
    pendingAuthCallback = url;
    if (panel && !panel.isDestroyed()) panel.webContents.send("bw:auth-callback", url);
  } catch {
    console.warn("Ignoring invalid authentication callback URL");
  }
}
electron.app.on("open-url", (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});
electron.app.on("second-instance", (_event, commandLine) => {
  const callback = commandLine.find((arg) => arg.startsWith("banwars://auth/callback"));
  if (callback) handleAuthCallback(callback);
  if (panel && !panel.isDestroyed()) {
    panel.show();
    panel.focus();
  }
});
const settingsFile = () => node_path.join(electron.app.getPath("userData"), "settings.json");
const loadSettings = () => {
  try {
    return JSON.parse(node_fs.readFileSync(settingsFile(), "utf8"));
  } catch {
    return {};
  }
};
const gameDisplay = () => electron.screen.getAllDisplays().find((d) => d.id === loadSettings().displayId) ?? electron.screen.getPrimaryDisplay();
function load(win, hash) {
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/${hash}`);
  else win.loadFile(node_path.join(__dirname, "../renderer/index.html"), { hash: `/${hash}` });
}
function createOverlay() {
  overlay = new electron.BrowserWindow({
    ...gameDisplay().bounds,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: { preload: node_path.join(__dirname, "../preload/index.js"), contextIsolation: true, sandbox: false }
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setIgnoreMouseEvents(true, { forward: true });
  load(overlay, "overlay");
}
function createPanel() {
  const title = `Ban Wars v.${electron.app.getVersion()}`;
  panel = new electron.BrowserWindow({
    width: 380,
    height: 720,
    minWidth: 340,
    backgroundColor: "#4a4a4a",
    title,
    autoHideMenuBar: true,
    webPreferences: { preload: node_path.join(__dirname, "../preload/index.js"), contextIsolation: true, sandbox: false }
  });
  panel.webContents.on("page-title-updated", (event) => {
    event.preventDefault();
    panel.setTitle(title);
  });
  load(panel, "panel");
  panel.on("closed", () => electron.app.quit());
}
function toggleInteractive() {
  interactive = !interactive;
  overlay.setIgnoreMouseEvents(!interactive, { forward: true });
  overlay.setFocusable(interactive);
  if (interactive) overlay.focus();
  overlay.webContents.send("bw:interactive", interactive);
}
electron.app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  if (process.defaultApp) {
    electron.app.setAsDefaultProtocolClient("banwars", process.execPath, [electron.app.getAppPath()]);
  } else {
    electron.app.setAsDefaultProtocolClient("banwars");
  }
  createOverlay();
  createPanel();
  startSync(SERVER_URL, () => [overlay, panel]);
  electron.globalShortcut.register("F10", toggleInteractive);
  electron.ipcMain.handle("bw:openAuthUrl", async (_event, value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      return { ok: false, error: "Invalid sign-in URL" };
    }
    if (url.protocol !== "https:" || url.pathname !== "/auth/v1/authorize" || !["google", "apple"].includes(url.searchParams.get("provider") ?? "")) {
      return { ok: false, error: "Unexpected sign-in URL" };
    }
    await electron.shell.openExternal(url.toString());
    return { ok: true };
  });
  electron.ipcMain.handle("bw:getAuthCallback", () => pendingAuthCallback);
  electron.ipcMain.handle("bw:clearAuthCallback", (_event, url) => {
    if (pendingAuthCallback === url) pendingAuthCallback = null;
  });
  electron.ipcMain.handle("bw:copyText", (_event, text) => {
    if (typeof text !== "string" || !text.trim()) throw new TypeError("Clipboard text must be a non-empty string");
    electron.clipboard.writeText(text);
  });
  electron.ipcMain.handle("bw:resetOverlayPosition", () => {
    if (!overlay.isDestroyed()) overlay.webContents.send("bw:reset-overlay-position");
  });
  electron.ipcMain.handle("bw:displays", () => electron.screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Display ${i + 1} (${d.size.width}x${d.size.height})`, selected: d.id === gameDisplay().id })));
  electron.ipcMain.handle("bw:setDisplay", (_e, id) => {
    node_fs.writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), displayId: id }));
    overlay.setBounds(gameDisplay().bounds);
  });
  const initialAuthCallback = process.argv.find((arg) => arg.startsWith("banwars://auth/callback"));
  if (initialAuthCallback) handleAuthCallback(initialAuthCallback);
  if (electron.app.isPackaged) {
    electronUpdater.autoUpdater.autoDownload = true;
    electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
    electronUpdater.autoUpdater.on("error", (error) => console.error("Auto-update failed:", error));
    void electronUpdater.autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error("Auto-update check failed:", error);
    });
  }
});
electron.app.on("will-quit", () => electron.globalShortcut.unregisterAll());
