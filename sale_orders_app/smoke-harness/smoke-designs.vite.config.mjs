// Vite config for the header-designs smoke harness (mirrors smoke-detector.vite.config.mjs).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.join(os.tmpdir(), 'header-designs-smoke-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'smoke-harness/header-designs.jsx'),
      output: { format: 'iife', name: 'HeaderDesignsHarness', inlineDynamicImports: true }
    }
  }
});
