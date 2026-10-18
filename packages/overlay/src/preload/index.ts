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
  displays: () => ipcRenderer.invoke('bw:displays'),
  setDisplay: (id: number) => ipcRenderer.invoke('bw:setDisplay', id),
});
