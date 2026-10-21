import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const root = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  return {
    envDir: root,
    plugins: [react()],
    resolve: {
      alias: {
        '@shortform/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
        '@ds': path.resolve(__dirname, '../design-system'),
        antd: path.resolve(__dirname, 'node_modules/antd'),
        '@ant-design/icons': path.resolve(__dirname, 'node_modules/@ant-design/icons'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      fs: { allow: [root] },
      proxy: { '/api': { target: env.VITE_API_PROXY || 'http://localhost:3000', changeOrigin: true } },
    },
  };
});
