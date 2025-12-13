# 天機·火控雷達 (TianJi FCR) v3.0

> **「萬般帶不走，唯有業隨身。但如果你有槓桿，業障會來得特別快。」** —— 天機 AI 財務軍師

一個結合命理智慧與現代金融風控的財務監控系統，支援台股、美股與加密貨幣。內建 AI 財務軍師，可根據八字格局與持倉數據給出客製化建議。

## 📸 功能預覽

- **四大資產模組**：台股、美股、加密貨幣、負債管理
- **即時槓桿監控**：總體/台股/幣圈三元槓桿計算
- **槓桿計算明細**：展開顯示完整公式分解
- **台股即時報價**：串接證交所 API
- **幣安即時價格**：一鍵更新所有加密貨幣現價
- **AI 財務軍師**：結合八字命理的專業財務建議
- **八字自動計算**：輸入生辰自動算出四柱八字

---

## 🚀 本地部署教學

### 系統需求

- **Node.js** 18.0+ (建議使用 LTS 版本)
- **npm** 或 **yarn**
- **DeepSeek API Key** (AI 功能需要)

### 步驟 1：下載專案

```bash
git clone https://github.com/LIUXVuse/TianJi-FCR.git
cd TianJi-FCR
```

### 步驟 2：安裝依賴

```bash
npm install
```

### 步驟 3：設定 API Key

在專案根目錄創建 `.env.local` 檔案：

```bash
# .env.local
DEEPSEEK_API_KEY=sk-你的DeepSeek-API-Key
```

> 💡 DeepSeek API Key 可在 <https://platform.deepseek.com> 申請

### 步驟 4：啟動開發伺服器

```bash
npm run dev
```

### 步驟 5：開啟瀏覽器

訪問 <http://localhost:3000>

---

## 🔮 功能特色

### 1. 真實槓桿計算

| 項目 | 計算公式 |
|-----|---------|
| **總體槓桿** | 總曝險 ÷ 總淨值 |
| **台股槓桿** | 台股市值 ÷ 台股淨權益 |
| **幣圈槓桿** | 幣圈倉位 ÷ 幣圈淨權益 |

點擊「槓桿計算明細」可展開查看完整公式分解。

### 2. 台股模組 (TWD)

- ✅ 現價/成本價輸入，自動計算盈虧
- ✅ **融資模式**：2.5 倍槓桿 (自備4成/借6成)
- ✅ **質押模式**：自訂質押成數
- ✅ **證交所即時報價**：盤中即時價，盤後收盤價
- ✅ **一鍵更新**：批次更新所有持股現價

### 3. 美股模組 (USD) 🆕

- ✅ 支援美股部位管理
- ✅ 自動匯率換算 (USD → TWD)
- ✅ 損益追蹤

### 4. 加密貨幣模組 (USDT)

- ✅ **現貨 (Spot)**：無槓桿持倉
- ✅ **合約 (Future)**：支援槓桿
- ✅ **幣安即時價格**：自動取得幣價
- ✅ **一鍵更新**：批次更新所有持倉現價
- ✅ 自動匯率換算 (USDT → TWD)

### 5. 負債管理 🆕

- ✅ 支援信貸、房貸、車貸、其他
- ✅ 自動計算總負債
- ✅ 納入淨值計算

### 6. USDT/TWD 匯率

- ✅ **MAX 交易所即時匯率**
- ✅ 手動輸入調整

### 7. AI 財務軍師

- ✅ **DeepSeek API**：使用 deepseek-chat 模型
- ✅ **命理人設**：結合八字、紫微斗數
- ✅ **完整數據傳送**：所有持倉明細
- ✅ **問題輸入**：⌘+Enter 送出
- ✅ **自訂人設**：可輸入個人八字資料

### 8. 八字計算 🆕

- ✅ **lunar-javascript 庫**：精確計算
- ✅ 輸入西曆生辰，自動算出四柱八字
- ✅ 五行分布統計
- ✅ 節氣、農曆日期

### 9. 本地資料庫 🆕

- ✅ **IndexedDB**：穩定可靠
- ✅ 自動從 localStorage 遷移
- ✅ 雙寫策略，不易遺失資料

---

## 📁 專案結構

```text
tianji-fcr/
├── App.tsx                # 主應用程式
├── types.ts               # TypeScript 類型定義
├── components/
│   ├── StockSection.tsx     # 台股模組
│   ├── USStockSection.tsx   # 美股模組 🆕
│   ├── CryptoSection.tsx    # 加密貨幣模組
│   ├── DebtSection.tsx      # 負債模組 🆕
│   ├── CalculationBreakdown.tsx # 計算明細 🆕
│   └── TianJiCard.tsx       # 通用卡片元件
├── services/
│   ├── deepseekService.ts   # AI 財務建議
│   ├── baziService.ts       # 八字計算 🆕
│   ├── dbService.ts         # IndexedDB 服務 🆕
│   ├── twseService.ts       # 證交所報價
│   ├── binanceService.ts    # 幣安價格
│   └── maxService.ts        # MAX 匯率
├── vite.config.ts         # Vite 設定 (含 API proxy)
├── API_SPEC.md            # API 規格文件
└── .env.local             # 環境變數 (需自行建立)
```

---

## 🔧 API 服務

| 服務 | 來源 | 費用 | 說明 |
|-----|------|-----|------|
| **台股報價** | 證交所 (TWSE) | 免費 | 盤中即時/盤後收盤 |
| **幣價** | 幣安 (Binance) | 免費 | USDT 交易對 |
| **匯率** | MAX 交易所 | 免費 | USDT/TWD |
| **AI** | DeepSeek | 付費 | 需申請 API Key |
| **八字** | lunar-javascript | 免費 | 本地計算 |

---

## ⚠️ 注意事項

1. **DeepSeek API Key 必填**：AI 功能需要設定 API Key
2. **CORS 已處理**：透過 Vite proxy 解決跨域問題
3. **僅供參考**：本系統建議僅供參考，投資請自行判斷
4. **數據安全**：所有數據儲存在本地，不會上傳

---

## 🧙‍♂️ AI 預設人設

```text
你是一位精通《子平八字》、《紫微斗數》、《六壬神課》，
且深諳現代科技與商業戰略的 30 年經驗命理大師（自稱「老夫」）。

風格：半文半白、語氣狂妄但邏輯嚴密、一針見血。
任務：擔任用戶的軍師，協助財務規劃。
```

可在 AI 設定中自訂人設（點擊齒輪按鈕）。

---

## 📝 更新日誌

### v3.0 (2024-12)

- ✨ 新增美股模組 (USD)
- ✨ 新增負債管理 (信貸/房貸/車貸)
- ✨ 新增槓桿計算明細展開區
- ✨ 新增八字自動計算 (lunar-javascript)
- ✨ 新增 IndexedDB 本地資料庫
- ✨ 新增資料自動遷移功能
- 🔧 優化 AI 提示詞架構
- 🔧 修復資料遺失問題

### v2.5 (2024-12)

- ✨ 新增 DeepSeek AI 財務軍師
- ✨ 新增台股即時報價 (證交所 API)
- ✨ 新增幣安即時價格 API
- ✨ 新增 MAX 交易所匯率 API
- ✨ 新增 AI 人設自訂功能
- 🔧 修復 CORS 跨域問題

---

*Powered by DeepSeek AI & lunar-javascript*
