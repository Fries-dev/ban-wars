"use strict";
const electron = require("electron");
const sub = (ch) => (cb) => {
  const h = (_e, d) => cb(d);
  electron.ipcRenderer.on(ch, h);
  return () => electron.ipcRenderer.removeListener(ch, h);
};
electron.contextBridge.exposeInMainWorld("bw", {
  emit: (event, payload = {}) => electron.ipcRenderer.invoke("bw:emit", event, payload),
  getState: () => electron.ipcRenderer.invoke("bw:getState"),
  getSession: () => electron.ipcRenderer.invoke("bw:getSession"),
  onState: sub("party:state"),
  onEvent: sub("party:event"),
  getConn: () => electron.ipcRenderer.invoke("bw:getConn"),
  onConn: sub("bw:conn"),
  onSession: sub("bw:session"),
  onInteractive: sub("bw:interactive"),
  openAuthUrl: (url) => electron.ipcRenderer.invoke("bw:openAuthUrl", url),
  getAuthCallback: () => electron.ipcRenderer.invoke("bw:getAuthCallback"),
  clearAuthCallback: (url) => electron.ipcRenderer.invoke("bw:clearAuthCallback", url),
  onAuthCallback: sub("bw:auth-callback"),
  copyText: (text) => electron.ipcRenderer.invoke("bw:copyText", text),
  onResetOverlayPosition: sub("bw:reset-overlay-position"),
  resetOverlayPosition: () => electron.ipcRenderer.invoke("bw:resetOverlayPosition"),
  displays: () => electron.ipcRenderer.invoke("bw:displays"),
  setDisplay: (id) => electron.ipcRenderer.invoke("bw:setDisplay", id)
});
