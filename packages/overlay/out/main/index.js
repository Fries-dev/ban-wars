"use strict";
const electron = require("electron");
const electronUpdater = require("electron-updater");
const node_fs = require("node:fs");
const node_path = require("node:path");
const socket_ioClient = require("socket.io-client");
const node_module = require("node:module");
const Tesseract = require("tesseract.js");
function winnerFromResultText(text, localTeam) {
  const normalized = text.toUpperCase().replace(/\s+/g, " ");
  const victory = /\b(VICTORY|MATCH WON|YOU WIN)\b/.test(normalized);
  const defeat = /\b(DEFEAT|MATCH LOST|YOU LOSE)\b/.test(normalized);
  if (victory === defeat) return null;
  return victory ? localTeam : localTeam === "A" ? "B" : "A";
}
class ScreenshotMatchSource {
  constructor(onResult, onError) {
    this.onResult = onResult;
    this.onError = onError;
    this.timer = setInterval(() => {
      void this.poll();
    }, 3e3);
  }
  require = node_module.createRequire(node_path.join(__dirname, "match-source.js"));
  timer;
  options = { enabled: false, active: false, displayId: 0, team: null };
  worker = null;
  polling = false;
  reported = false;
  lastError = null;
  update(options) {
    if (!options.active || !options.enabled) this.reported = false;
    this.options = options;
  }
  setError(message) {
    if (message === this.lastError) return;
    this.lastError = message;
    this.onError(message);
    if (message) console.error(`Automatic win detection failed: ${message}`);
  }
  async stop() {
    clearInterval(this.timer);
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
  async getWorker() {
    if (this.worker) return this.worker;
    const model = this.require("@tesseract.js-data/eng");
    this.worker = await Tesseract.createWorker("eng", void 0, {
      langPath: model.langPath,
      gzip: model.gzip,
      cacheMethod: "none"
    });
    return this.worker;
  }
  async poll() {
    const options = this.options;
    if (this.polling || this.reported || !options.enabled || !options.active || !options.team) return;
    this.polling = true;
    try {
      const sources = await electron.desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1280, height: 720 }
      });
      const source = sources.find((item) => item.display_id === String(options.displayId));
      if (!source) throw new Error("Could not capture the selected game monitor. Check the Game Monitor setting.");
      const worker = await this.getWorker();
      const { data: { text } } = await worker.recognize(source.thumbnail.toPNG());
      this.setError(null);
      const winner = winnerFromResultText(text, options.team);
      if (!winner) return;
      if (await this.onResult({ winner })) {
        this.reported = true;
      }
    } catch (error) {
      this.setError(error instanceof Error ? error.message : "Could not read the match result from the game screen.");
    } finally {
      this.polling = false;
    }
  }
}
function startSync(serverUrl, windows, getDetectionSettings) {
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
  const matchSource = new ScreenshotMatchSource((result) => new Promise((resolve) => {
    if (!socket.connected) {
      matchSource.setError("The server is offline. Automatic result reporting will retry when connected.");
      resolve(false);
      return;
    }
    socket.timeout(5e3).emit("match:result", result, (error, response) => {
      if (error) {
        matchSource.setError("The server did not respond to the automatic result. Detection will retry.");
        resolve(false);
      } else if (!response.ok) {
        matchSource.setError(response.error ?? "The server rejected the automatic result.");
        resolve(false);
      } else {
        resolve(true);
      }
    });
  }), (message) => send("bw:win-detection-error", message));
  const updateMatchDetection2 = () => {
    const settings = getDetectionSettings();
    const hostPlayer = lastState?.players.find((player) => player.id === session?.playerId);
    const activeHostMatch = !!session && socket.connected && lastState?.hostId === session.playerId && lastState.phase === "inMatch";
    const team = activeHostMatch ? hostPlayer?.team ?? null : null;
    matchSource.update({ ...settings, active: activeHostMatch, team });
  };
  socket.on("party:state", (s) => {
    lastState = s;
    send("party:state", s);
    updateMatchDetection2();
  });
  for (const name of ["ban:applied", "ban:removed", "toast", "party:kicked"])
    socket.on(name, (payload) => {
      if (name === "party:kicked") {
        persistSession(null);
        lastState = null;
        send("bw:session", null);
        updateMatchDetection2();
      }
      send("party:event", { name, payload });
    });
  socket.on("connect", () => {
    send("bw:conn", true);
    updateMatchDetection2();
  });
  socket.on("disconnect", () => {
    send("bw:conn", false);
    updateMatchDetection2();
  });
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
          updateMatchDetection2();
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
        updateMatchDetection2();
      }
      if (r?.ok && (event === "party:create" || event === "party:join")) {
        persistSession({ code: r.code, nick: String(payload.nick), token: r.token, playerId: r.playerId });
        send("bw:session", { code: r.code, playerId: r.playerId });
        updateMatchDetection2();
      }
      resolve(r);
    });
  }));
  electron.ipcMain.handle("bw:getSession", () => session && { code: session.code, playerId: session.playerId });
  electron.ipcMain.handle("bw:getConn", () => socket.connected);
  electron.ipcMain.handle("bw:getState", () => lastState);
  electron.app.on("will-quit", () => {
    void matchSource.stop();
  });
  return updateMatchDetection2;
}
const SERVER_URL = "http://localhost:3001";
let overlay;
let panel;
let interactive = false;
let pendingAuthCallback = null;
let pendingPartyCode = null;
let updateMatchDetection;
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
function handlePartyInvite(url) {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code")?.toUpperCase() ?? "";
    if (parsed.protocol !== "banwars:" || parsed.hostname !== "join" || !/^BW-[23456789A-HJ-NP-Z]{4}$/.test(code)) return;
    pendingPartyCode = code;
    if (panel && !panel.isDestroyed()) {
      panel.webContents.send("bw:party-invite", code);
      panel.show();
      panel.focus();
    }
  } catch {
    console.warn("Ignoring invalid party invite URL");
  }
}
function handleProtocolUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "banwars:") return;
    if (parsed.hostname === "auth" && parsed.pathname === "/callback") handleAuthCallback(url);
    else if (parsed.hostname === "join") handlePartyInvite(url);
  } catch {
    console.warn("Ignoring invalid Ban Wars URL");
  }
}
electron.app.on("open-url", (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});
electron.app.on("second-instance", (_event, commandLine) => {
  const protocolUrl = commandLine.find((arg) => arg.startsWith("banwars://"));
  if (protocolUrl) handleProtocolUrl(protocolUrl);
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
const saveSettings = (settings) => node_fs.writeFileSync(settingsFile(), JSON.stringify(settings));
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
    minHeight: 500,
    backgroundColor: "#4a4a4a",
    title,
    frame: false,
    resizable: false,
    fullscreenable: false,
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
  if (!hasSingleInstanceLock) {
    electron.app.quit();
    return;
  }
  if (process.defaultApp) {
    electron.app.setAsDefaultProtocolClient("banwars", process.execPath, [electron.app.getAppPath()]);
  } else {
    electron.app.setAsDefaultProtocolClient("banwars");
  }
  createOverlay();
  createPanel();
  updateMatchDetection = startSync(SERVER_URL, () => [overlay, panel], () => ({
    enabled: loadSettings().autoDetectWins === true,
    displayId: gameDisplay().id
  }));
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
  electron.ipcMain.handle("bw:getPendingPartyCode", () => pendingPartyCode);
  electron.ipcMain.handle("bw:clearPendingPartyCode", (_event, code) => {
    if (pendingPartyCode === code) pendingPartyCode = null;
  });
  electron.ipcMain.handle("bw:copyText", (_event, text) => {
    if (typeof text !== "string" || !text.trim()) throw new TypeError("Clipboard text must be a non-empty string");
    electron.clipboard.writeText(text);
  });
  electron.ipcMain.handle("bw:panelVersion", () => electron.app.getVersion());
  electron.ipcMain.handle("bw:panelControl", (event, action) => {
    if (event.sender !== panel.webContents) throw new Error("Panel window controls may only be used by the panel");
    if (action === "minimize") panel.minimize();
    else if (action === "close") panel.close();
    else throw new TypeError("Unknown panel window action");
  });
  electron.ipcMain.handle("bw:getAutoDetectWins", (event) => {
    if (event.sender !== panel.webContents) throw new Error("Win detection settings may only be read by the panel");
    return loadSettings().autoDetectWins === true;
  });
  electron.ipcMain.handle("bw:setAutoDetectWins", (event, enabled) => {
    if (event.sender !== panel.webContents) throw new Error("Win detection settings may only be changed by the panel");
    if (typeof enabled !== "boolean") throw new TypeError("Automatic win detection setting must be boolean");
    saveSettings({ ...loadSettings(), autoDetectWins: enabled });
    updateMatchDetection?.();
  });
  electron.ipcMain.handle("bw:resetOverlayPosition", () => {
    if (!overlay.isDestroyed()) overlay.webContents.send("bw:reset-overlay-position");
  });
  electron.ipcMain.handle("bw:displays", () => electron.screen.getAllDisplays().map((d, i) => ({ id: d.id, label: `Display ${i + 1} (${d.size.width}x${d.size.height})`, selected: d.id === gameDisplay().id })));
  electron.ipcMain.handle("bw:setDisplay", (_e, id) => {
    saveSettings({ ...loadSettings(), displayId: id });
    overlay.setBounds(gameDisplay().bounds);
    updateMatchDetection?.();
  });
  const initialProtocolUrl = process.argv.find((arg) => arg.startsWith("banwars://"));
  if (initialProtocolUrl) handleProtocolUrl(initialProtocolUrl);
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
