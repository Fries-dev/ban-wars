import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@banwars/shared'] })],
    define: { 'process.env.BW_SERVER': JSON.stringify(process.env.BW_SERVER ?? 'http://localhost:3001') }
  },
  preload: { plugins: [externalizeDepsPlugin({ exclude: ['@banwars/shared'] })] },
  renderer: { root: 'src/renderer', envDir: '../..', plugins: [react()] }
});
