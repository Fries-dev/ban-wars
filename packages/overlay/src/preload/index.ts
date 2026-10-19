import { contextBridge, ipcRenderer } from 'electron';

const sub = (ch: string) => (cb: (d: any) => void) => {
  const h = (_e: unknown, d: unknown) => cb(d);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld('bw', {
  emit: (event: string, payload: object = {}) => ipcRenderer.invoke('bw:emit', event, payload),
  getState: () => ipcRenderer.invoke('bw:getState'),
  getSession: () => ipcRenderer.invoke('bw:getSession'),
  onState: sub('party:state'),
  onEvent: sub('party:event'),
  getConn: () => ipcRenderer.invoke('bw:getConn'),
  onConn: sub('bw:conn'),
  onSession: sub('bw:session'),
  onInteractive: sub('bw:interactive'),
  openAuthUrl: (url: string) => ipcRenderer.invoke('bw:openAuthUrl', url),
  getAuthCallback: () => ipcRenderer.invoke('bw:getAuthCallback'),
  clearAuthCallback: (url: string) => ipcRenderer.invoke('bw:clearAuthCallback', url),
  onAuthCallback: sub('bw:auth-callback'),
  getPendingPartyCode: () => ipcRenderer.invoke('bw:getPendingPartyCode'),
  clearPendingPartyCode: (code: string) => ipcRenderer.invoke('bw:clearPendingPartyCode', code),
  onPartyInvite: sub('bw:party-invite'),
  copyText: (text: string) => ipcRenderer.invoke('bw:copyText', text),
  panelVersion: () => ipcRenderer.invoke('bw:panelVersion'),
  panelControl: (action: 'minimize' | 'close') => ipcRenderer.invoke('bw:panelControl', action),
  onResetOverlayPosition: sub('bw:reset-overlay-position'),
  resetOverlayPosition: () => ipcRenderer.invoke('bw:resetOverlayPosition'),
  displays: () => ipcRenderer.invoke('bw:displays'),
  setDisplay: (id: number) => ipcRenderer.invoke('bw:setDisplay', id),
});
