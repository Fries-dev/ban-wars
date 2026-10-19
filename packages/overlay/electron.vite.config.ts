import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const configuredServer = process.env.BW_SERVER?.trim();
const serverUrl = configuredServer
  ? (/^https?:\/\//i.test(configuredServer) ? configuredServer : `https://${configuredServer}`)
  : 'http://localhost:3001';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@banwars/shared'] })],
    define: { 'process.env.BW_SERVER': JSON.stringify(serverUrl) }
  },
  preload: { plugins: [externalizeDepsPlugin({ exclude: ['@banwars/shared'] })] },
  renderer: {
    root: 'src/renderer',
    envDir: '../..',
    plugins: [react()],
    define: { 'import.meta.env.VITE_BW_SERVER': JSON.stringify(serverUrl) }
  }
});
