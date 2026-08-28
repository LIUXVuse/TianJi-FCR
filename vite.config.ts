import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// ── Supabase 後端代寫 proxy ──────────────────────────────────
// 為什麼要有這層：Supabase 所有表已開 RLS 且沒有任何 policy，
// 前端的 anon key 讀會靜默回空陣列、寫會被 401 擋掉
// （2026-08-01 起，雲端同步從那天就整個停擺）。
// service key 可以繞過 RLS，但**絕對不能進瀏覽器**，所以放在這裡由 Node 注入：
// 前端打 /api/db/rest/v1/<table>，proxy 換上 service key 再轉給 Supabase。
//
// 只放行自己的資產表 —— 不讓它變成 service key 的萬用通道
//（Supabase 上還有 subscribers / payments 等表，不該從瀏覽器碰得到）。
const DB_ALLOWED_TABLES = [
  'user_settings',
  'stock_positions',
  'us_stock_positions',
  'crypto_positions',
  'debts',
  'daily_snapshots',
  'goals',
];

const createDbProxy = (supabaseUrl: string, serviceKey: string) => ({
  target: supabaseUrl,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/api\/db/, ''),
  configure: (proxy: any) => {
    proxy.on('proxyReq', (proxyReq: any, req: any, res: any) => {
      const table = (req.url || '')
        .replace(/^\/api\/db/, '')
        .replace(/^\/rest\/v1\//, '')
        .split(/[?/]/)[0];

      if (!DB_ALLOWED_TABLES.includes(table)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `table not allowed: ${table}` }));
        proxyReq.destroy();
        return;
      }
      // 覆蓋掉前端送來的佔位金鑰
      proxyReq.setHeader('apikey', serviceKey);
      proxyReq.setHeader('Authorization', `Bearer ${serviceKey}`);
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const dbProxy = env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY
    ? { '/api/db': createDbProxy(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY) }
    : {};
  if (!env.SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  .env.local 沒有 SUPABASE_SERVICE_KEY，雲端同步會失效（見 vite.config.ts 註解）');
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        ...dbProxy,
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
    preview: {
      port: 3000,
      host: '0.0.0.0',
      proxy: { ...dbProxy },
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
