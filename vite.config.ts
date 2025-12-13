import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/deepseek': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
        },
        '/api/twse': {
          target: 'https://mis.twse.com.tw',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/twse/, ''),
        },
        '/api/max': {
          target: 'https://max-api.maicoin.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/max/, ''),
        },
        '/api/yahoo': {
          target: 'https://query1.finance.yahoo.com/v8/finance/chart',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
