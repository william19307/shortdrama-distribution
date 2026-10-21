import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({ root: 'v2', plugins: [react(), viteSingleFile()], base: './', build: { outDir: '../dist-v2', emptyOutDir: true, chunkSizeWarningLimit: 99999 } });
