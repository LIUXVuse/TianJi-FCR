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
        // ========== 量化系統 API (tw-quant-simple) ==========
        '/quant': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/quant/, ''),
        },
        // 量化系統 API 路徑 - 直接代理到後端
        '/api/status': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/backtest': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/portfolio': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/download': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/signals': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/scan': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/optimize': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/tickers': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/scheduler': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/reports': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api/monitor': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/reports': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        // ========== 天機自用 API ==========
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
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
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
