// Vite config for the permissions resolver smoke (pure logic, bundled for Node).
import { defineConfig } from 'vite';
import os from 'os';
import path from 'path';

export default defineConfig({
  build: {
    outDir: path.join(os.tmpdir(), 'perms-smoke-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(process.cwd(), 'smoke-harness/permissions-smoke.mjs'),
      output: { format: 'cjs', inlineDynamicImports: true }
    }
  }
});
