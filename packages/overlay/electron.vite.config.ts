import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin({ exclude: ['@banwars/shared'] })] },
  preload: { plugins: [externalizeDepsPlugin({ exclude: ['@banwars/shared'] })] },
  renderer: { root: 'src/renderer', plugins: [react()] }
});
