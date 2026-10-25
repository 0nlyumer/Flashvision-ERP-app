// Vite config for the band-contrast smoke harness (see
// smoke-harness/band-contrast.jsx). Builds the harness as a single IIFE
// bundle + one CSS file into /tmp so smoke-band-contrast.mjs can load it
// via file:// in headless Chrome — file:// avoids this sandbox's
// loopback network restrictions, and classic scripts sidestep module
// CORS on file://.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.join(os.tmpdir(), 'band-contrast-smoke-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'smoke-harness/band-contrast.jsx'),
      output: { format: 'iife', name: 'BandContrastHarness', inlineDynamicImports: true }
    }
  }
});
