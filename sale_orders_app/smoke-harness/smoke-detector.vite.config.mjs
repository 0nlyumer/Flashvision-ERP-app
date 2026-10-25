// Vite config for the band-detector smoke harness (mirrors smoke.vite.config.mjs).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.join(os.tmpdir(), 'band-detector-smoke-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'smoke-harness/band-detector.jsx'),
      output: { format: 'iife', name: 'BandDetectorHarness', inlineDynamicImports: true }
    }
  }
});
