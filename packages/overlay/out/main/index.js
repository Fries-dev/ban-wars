"use strict";
const electron = require("electron");
const electronUpdater = require("electron-updater");
const node_fs = require("node:fs");
const node_path = require("node:path");
const socket_ioClient = require("socket.io-client");
function startSync(serverUrl, windows) {
  const socket = socket_ioClient.io(serverUrl, { reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5e3 });
  let session = null;
  let lastState = null;
  const send = (ch, data) => windows().forEach((w) => !w.isDestroyed() && w.webContents.send(ch, data));
  socket.on("party:state", (s) => {
    lastState = s;
    send("party:state", s);
  });
  for (const name of ["ban:applied", "ban:removed", "toast", "party:kicked"])
    socket.on(name, (payload) => {
      if (name === "party:kicked") {
        session = null;
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
          session = null;
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
        session = null;
        lastState = null;
        send("bw:session", null);
      }
      if (r?.ok && (event === "party:create" || event === "party:join")) {
        session = { code: r.code, nick: String(payload.nick), token: r.token, playerId: r.playerId };
        send("bw:session", { code: r.code, playerId: r.playerId });
      }
      resolve(r);
    });
  }));
  electron.ipcMain.handle("bw:getSession", () => session && { code: session.code, playerId: session.playerId });
  electron.ipcMain.handle("bw:getConn", () => socket.connected);
  electron.ipcMain.handle("bw:getState", () => lastState);
}
const SERVER_URL = process.env.BW_SERVER ?? "http://localhost:3001";
let overlay;
let panel;
let interactive = false;
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
  panel = new electron.BrowserWindow({
    width: 380,
    height: 720,
    minWidth: 340,
    backgroundColor: "#4a4a4a",
    title: "Ban Wars",
    autoHideMenuBar: true,
    webPreferences: { preload: node_path.join(__dirname, "../preload/index.js"), contextIsolation: true, sandbox: false }
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
  createOverlay();
  createPanel();
  startSync(SERVER_URL, () => [overlay, panel]);
  electron.globalShortcut.register("F10", toggleInteractive);
  electron.ipcMain.handle("bw:displays", () => electron.screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Display ${i + 1} (${d.size.width}x${d.size.height})`, selected: d.id === gameDisplay().id })));
  electron.ipcMain.handle("bw:setDisplay", (_e, id) => {
    node_fs.writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), displayId: id }));
    overlay.setBounds(gameDisplay().bounds);
  });
  if (electron.app.isPackaged) electronUpdater.autoUpdater.checkForUpdatesAndNotify();
});
electron.app.on("will-quit", () => electron.globalShortcut.unregisterAll());
