// Vite config for the Round 6 header-designs smoke harness (mirrors smoke-stylish.vite.config.mjs).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.join(os.tmpdir(), 'header-round6-smoke-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'smoke-harness/header-round6.jsx'),
      output: { format: 'iife', name: 'HeaderRound6Harness', inlineDynamicImports: true }
    }
  }
});
