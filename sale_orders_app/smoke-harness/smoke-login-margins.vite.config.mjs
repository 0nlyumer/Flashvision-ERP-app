// Vite config for the login-margins smoke harness (mirrors smoke-designs.vite.config.mjs).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.join(os.tmpdir(), 'login-margins-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'smoke-harness/login-margins.jsx'),
      output: { format: 'iife', name: 'LoginMarginsHarness', inlineDynamicImports: true }
    }
  }
});
