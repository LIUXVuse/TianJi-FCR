# 天機·火控雷達 交班文件

## 🔴 2026-08-28：修好雲端同步（停擺四週）

**症狀**：網頁畫面一切正常，但 Supabase 的資料**從 2026-08-01 02:41 之後就沒再變過**。
所有表的 `updated_at` 都停在同一秒，`debts` 表甚至是空的。

**原因**：2026-08-01 Supabase 把所有表開了 RLS（Row Level Security）**但沒有建任何 policy**。
前端用的 anon key 從那天起：
- **讀** → HTTP 200 但回傳 `[]`（**不報錯，所以完全沒人發現**）
- **寫** → HTTP 401 `new row violates row-level security policy`

網頁看起來正常，是因為它讀的是瀏覽器 localStorage，根本沒依賴雲端那份。

**修法**：前端不再直連 Supabase，改走**自己的 Vite proxy 當後端代寫**。

| | 改前 | 改後 |
|:---|:---|:---|
| 前端呼叫 | `https://xxx.supabase.co/rest/v1/...` | `/api/db/rest/v1/...`（同源）|
| 金鑰 | `VITE_SUPABASE_ANON_KEY`（**打包進 JS，公開**）| `SUPABASE_SERVICE_KEY`（**只在 Node 端**）|
| RLS | 被擋 | service key 繞過 |

改動只有三處：
1. `vite.config.ts` — 新增 `/api/db` proxy，`proxyReq` 時注入 service key，**並用 `DB_ALLOWED_TABLES` 白名單**
   只放行 7 張自己的資產表（不讓它變成 service key 的萬用通道，Supabase 上還有 subscribers/payments）
2. `services/supabaseService.ts` — client 指向 `${window.location.origin}/api/db`，金鑰用佔位字串
3. `.env.local` — 加 `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`（**沒有 VITE_ 前綴**）

**驗證結果**（2026-08-28）：
```
GET  /api/db/rest/v1/crypto_positions   → 200，7 筆資料
POST /api/db/rest/v1/crypto_positions   → 201（探針已刪除）
DEL  /api/db/rest/v1/crypto_positions   → 204
GET  /api/db/rest/v1/subscribers        → 403 table not allowed  ✅ 白名單有效
```
7 張表全部可讀：user_settings 1｜stock_positions 2｜us_stock_positions 2｜crypto_positions 7｜
debts 0｜daily_snapshots 594｜goals 3

**⚠️ 修好不等於資料回來了**：proxy 只是把路打通，**Supabase 上仍是 8/01 的舊資料**。
要在網頁上按一次 **☁️ 上傳**（`handleCloudUpload`），才會把 localStorage 的最新持倉推上去。

**⚠️ 注意 `saveXXXToCloud` 是「先全刪再全插」**（`.delete().neq('id','')` + `.insert()`）。
現在權限打通了，**按「上傳」會用瀏覽器當下的資料覆蓋雲端**。
所以要在**資料最新的那台裝置**上按上傳，不要在舊資料的裝置上按。


## 🚀 服務狀態：背景模式運行中（nohup）

目前以 `nohup` 背景啟動，**可以關終端**。重開機後需手動重啟（尚未設為 LaunchAgent）。

---

## 網頁入口

| 用途 | 本機網址 | 區網網址（其他設備） |
|------|---------|------------------|
| 前端主介面 | http://localhost:3000 | http://192.168.1.107:3000 |
| 量化後端 API | http://localhost:8000 | http://192.168.1.107:8000 |

---

## 啟動方式

```bash
cd '/Users/liu/Documents/porject/天機·火控雷達-(tianji-fcr)'
npm run dev
```

---

## ✅ 本次完成（2026-03-25）

### 質押負債邏輯修正（重要 Bug Fix）

**問題**：質押成數 60% 會隨股價上漲而自動增加負債顯示，邏輯錯誤。

**修正內容**：

| 檔案 | 異動 |
|------|------|
| `types.ts` | 新增 `pledgeFixedLoan: number` 欄位 |
| `components/StockSection.tsx` | `calculateLoan` 改為質押直接使用 `pledgeFixedLoan`；股價更新時質押 `loanAmount` 不重算；UI 新增「實際借出金額（固定）」輸入欄 |
| `API_SPEC.md` | 更新 `StockPosition` 欄位說明 |

**正確邏輯**：
- 融資（isMargin=true）：`loanAmount = costPrice × shares × 60%`（鎖定成本，自動計算）
- 質押（isMargin=false）：`loanAmount = pledgeFixedLoan`（手動填入固定金額，不隨股價變動）

---

## 🔴 下一個對話要先做

- Step 1：現有質押部位需手動更新 `pledgeFixedLoan`（填入實際借出金額），否則顯示為 0
  → 進網頁 → 編輯有質押的股票 → 填入「借出金額(固定)」欄位
- Step 2：考慮設定 LaunchAgent 讓天機也能開機自動啟動（目前需手動 `npm run dev`）

---

## ⚠️ 已知問題 / 注意事項

- **現有資料相容性**：舊資料的 `pledgeFixedLoan` 欄位預設為 `undefined`，需手動編輯補填
- 天機使用 Vite dev server，**不建議直接對外開放**，區網使用 `192.168.1.107:3000` 即可
- 量化後端（port 8000）使用 `tw-quant-simple/.venv` 虛擬環境

---

## 技術架構

```
前端：React + TypeScript + Vite (port 3000)
後端：Python FastAPI uvicorn (port 8000)
資料庫：IndexedDB（本地）+ Supabase（雲端備份）
```
