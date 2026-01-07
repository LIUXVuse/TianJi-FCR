# 天機·火控雷達 資料結構定義書 (API Spec)

本文件定義系統中的核心資料模型 (TypeScript Interfaces)。
雖然本系統目前使用 `localStorage` 作為儲存媒介，但此結構適用於未來遷移至雲端資料庫。

---

## 1. 全域設定 (GlobalSettings)

儲存使用者的基礎環境變數。

```typescript
interface GlobalSettings {
  /** USDT 對 TWD 的匯率 (預設: 31.3) */
  usdtTwdRate: number;
  
  /** USD 對 TWD 的匯率 (預設: 31.5) */
  usdTwdRate: number;
  
  /** 手頭持有的台幣現金 (TWD) */
  cashTwd: number;
  
  /** 手頭持有的美金現金 (USD) 🆕 */
  cashUsd: number;
  
  // --- 原始本金 (用於計算真實總獲利) 🆕 ---
  
  /** 原始台幣本金 */
  originalCapitalTwd: number;
  
  /** 原始美金本金 (USD) */
  originalCapitalUsd: number;
  
  /** 原始 USDT 本金 */
  originalCapitalUsdt: number;
}
```

---

## 2. 台股部位 (StockPosition)

描述單一檔台股的持倉狀態。

```typescript
interface StockPosition {
  /** 唯一識別碼 (Timestamp string) */
  id: string;
  
  /** 股票名稱 (如: 2330台積電) */
  name: string;
  
  /** 平均成本價 (TWD) */
  costPrice: number;
  
  /** 目前市價 (TWD) */
  price: number;
  
  /** 持有股數 (注意：非張數，1張=1000股) */
  shares: number;
  
  /** 是否使用融資 (2.5倍槓桿邏輯) */
  isMargin: boolean;
  
  /** 質押成數 (0-100) */
  pledgeRate: number;
  
  /** 借貸金額 (TWD)
   * 若 isMargin=true, loanAmount = costPrice * shares * 0.6
   * 若 isMargin=false, loanAmount = price * shares * (pledgeRate / 100)
   */
  loanAmount: number;
}
```

---

## 3. 美股部位 (USStockPosition)

描述單一檔美股的持倉狀態。

```typescript
interface USStockPosition {
  /** 唯一識別碼 */
  id: string;
  
  /** 股票代號 (如: AAPL, TSLA, NVDA) */
  symbol: string;
  
  /** 公司名稱 */
  name: string;
  
  /** 平均成本價 (USD) */
  costPrice: number;
  
  /** 目前市價 (USD) */
  price: number;
  
  /** 持有股數 (可小數，支援零股) */
  shares: number;
  
  // --- Margin 槓桿 (美股 Reg T 規則: 最高借50%) 🆕 ---
  
  /** 是否使用 Margin */
  isMargin: boolean;
  
  /** 借款比例 (0-50%) */
  marginRatio: number;
  
  /** 借款金額 (USD) */
  loanAmount: number;
  
  // --- 計算欄位 ---
  
  /** 市值 = price * shares (USD) */
  marketValue: number;
  
  /** 損益 (USD) */
  pnl: number;
  
  /** 損益率 (%) */
  pnlPercent: number;
}

interface USStockState {
  positions: USStockPosition[];
}
```

---

## 4. 加密貨幣狀態 (CryptoState)

描述使用者的加密貨幣資產組合。

```typescript
type CryptoType = 'SPOT' | 'FUTURE';

interface CryptoPosition {
  /** 唯一識別碼 */
  id: string;
  
  /** 類型: 現貨 (SPOT) 或 合約 (FUTURE) */
  type: CryptoType;
  
  /** 交易對名稱 (如: BTCUSDT) */
  symbol: string;
  
  // --- 合約專用 (FUTURE) ---
  
  /** 槓桿倍數 (如: 5)。若為 SPOT 則固定為 1 */
  leverage: number;
  
  /** 投入本金/保證金 (Margin, USDT) */
  margin: number;
  
  /** 強平價格 (可選，Cross Margin 建議手動輸入) 🆕 */
  liquidationPrice?: number;
  
  // --- 現貨專用 (SPOT) ---
  
  /** 持有顆數 (如: 0.5 BTC) */
  units: number;
  
  // --- 共通欄位 ---
  
  /** 開倉平均價格 (USDT) */
  entryPrice: number;
  
  /** 目前標記價格 (USDT) */
  currentPrice: number;
  
  // --- 計算欄位 ---
  
  /** 倉位名義價值 (Notional Value)
   * Spot: units * currentPrice
   * Future: margin * leverage
   */
  positionSize: number;
  
  /** 未實現損益 (USDT) */
  pnl: number;
  
  /** 未實現損益率 (%) */
  pnlPercent: number;
}

interface CryptoState {
  /** 尚未投入倉位的閒置 USDT */
  walletBalance: number;
  
  /** 部位列表 */
  positions: CryptoPosition[];
}
```

---

## 5. 負債 (DebtState)

描述使用者的負債狀況（信貸、房貸、車貸等）。

```typescript
type DebtType = 'credit' | 'mortgage' | 'car' | 'other';

interface DebtItem {
  /** 唯一識別碼 */
  id: string;
  
  /** 負債類型 */
  type: DebtType;
  
  /** 名稱說明 (如: 中信信貸、房貸) */
  name: string;
  
  /** 原始本金 (TWD) */
  principalAmount: number;
  
  /** 尚欠金額 (TWD) */
  outstandingAmount: number;
  
  /** 每月還款 (TWD) */
  monthlyPayment: number;
  
  /** 年利率 (%) */
  interestRate: number;
}

interface DebtState {
  debts: DebtItem[];
  totalDebt: number; // 總負債 (TWD)
}
```

**負債類型說明：**

| type | 說明 | 備註 |
|------|------|------|
| `credit` | 信用貸款 | 通常無擔保，利率較高 |
| `mortgage` | 房屋貸款 | 抵押貸款，利率較低 |
| `car` | 車貸 | 汽車貸款 |
| `other` | 其他負債 | 如：學貸、私人借款 |

---

## 6. 分析結果 (AnalysisResult)

由系統即時運算出的風控指標。

```typescript
interface AnalysisResult {
  // --- 總覽 ---
  
  /** 總淨值 = 總資產 - 總負債 (TWD) */
  netWorth: number;
  
  /** 總資產 (不扣負債) (TWD) */
  grossAssets: number;
  
  /** 總負債 (TWD) */
  totalDebt: number;
  
  /** 總風險曝險 (TWD) */
  totalExposure: number;
  
  // --- 槓桿四兄弟 ---
  
  /** 1. 總真實槓桿倍數 = totalExposure / netWorth */
  realLeverage: number;
  
  /** 2. 台股槓桿 = 台股市值 / (台股市值 - 融資金額) */
  stockLeverage: number;
  
  /** 3. 美股槓桿 (通常為 1，除非使用 Margin) */
  usStockLeverage: number;
  
  /** 4. 幣圈槓桿 = 幣圈總倉位 / 幣圈淨權益 */
  cryptoLeverage: number;
  
  // --- 各類損益 ---
  
  stockMaintenanceRate: number | null;
  totalStockPnL: number;
  totalStockPnLPercent: number;
  
  totalUSStockPnL: number;      // USD
  totalUSStockPnLPercent: number;
  
  totalCryptoPnL: number;       // TWD (已換算)
  totalCryptoPnLPercent: number;
}
```

---

## 7. 計算明細 (CalculationBreakdown)

展示槓桿計算的詳細步驟。

```typescript
interface CalculationBreakdown {
  // --- 資產 (Assets) ---
  
  cashTwd: number;           // 台幣現金
  stockEquityTwd: number;    // 台股淨權益 (市值 - 融資)
  usStockEquityTwd: number;  // 美股淨值 (換算TWD)
  cryptoEquityTwd: number;   // 幣圈淨值 (換算TWD)
  grossAssetsTwd: number;    // 總資產
  
  // --- 負債 (Liabilities) ---
  
  stockLoanTwd: number;      // 台股融資金額
  totalDebtTwd: number;      // 信貸+房貸+車貸
  totalLiabilities: number;  // 總負債
  
  // --- 曝險 (Exposure) ---
  
  stockExposureTwd: number;   // 台股曝險 (= 市值)
  usStockExposureTwd: number; // 美股曝險 (換算TWD)
  cryptoExposureTwd: number;  // 幣圈曝險 (換算TWD)
  totalExposure: number;      // 總曝險
  
  // --- 計算結果 ---
  
  netWorth: number;     // 淨值 = 總資產 - 總負債
  realLeverage: number; // 槓桿 = 總曝險 / 淨值
}
```

**槓桿計算公式：**

```text
真實槓桿 = 總曝險 ÷ 淨值

其中：
- 總曝險 = 台股市值 + 美股市值 + 幣圈倉位
- 淨值 = 現金 + 台股淨權益 + 美股淨值 + 幣圈淨值 - 負債

槓桿 < 1：有閒置資金
槓桿 = 1：全額投入
槓桿 > 1：使用槓桿/借貸
```

### 7.2 台股融資斷頭計算 🆕

```text
維持率 = (現價 × 股數) / 融資金額 × 100%

斷頭價 = 融資金額 × 1.30 / 股數

距離斷頭 % = (現價 - 斷頭價) / 現價 × 100%

警示條件：
- 維持率 < 140% → 變紅
- 距離斷頭 < 10% → 變紅
```

### 7.3 幣圈合約爆倉計算 🆕

```text
// 如果用戶輸入了強平價
if (liquidationPrice > 0) {
  距離爆倉 = (現價 - 強平價) / 現價 × 100%
}

// 否則使用預估公式 (Long)
預估強平價 = 開倉價 × (1 - 1/槓桿)
距離爆倉 = (現價 - 預估強平價) / 現價 × 100%

警示條件：
- 距離爆倉 < 10% → 變紅閃爆
```

---

## 8. 外部 API 服務

### 8.1 幣安即時價格 API (Binance)

```typescript
// 服務檔案: services/binanceService.ts
// 端點: https://api.binance.com/api/v3/ticker/price

async function getPrice(symbol: string): Promise<number | null>;
async function getPrices(symbols: string[]): Promise<Record<string, number>>;
```

### 8.2 台灣證交所即時報價 (TWSE)

```typescript
// 服務檔案: services/twseService.ts
// 端點: /api/twse (Vite proxy → mis.twse.com.tw)

async function getStockPrice(stockCode: string): Promise<number | null>;
async function getStockPrices(stockCodes: string[]): Promise<Record<string, number>>;
```

### 8.3 MAX 交易所 USDT/TWD 匯率

```typescript
// 服務檔案: services/maxService.ts
// 端點: /api/max (Vite proxy → max-api.maicoin.com)

async function getUsdtTwdRate(): Promise<{
  last: number;  // 最新成交價
  buy: number;   // 買價
  sell: number;  // 賣價
} | null>;
```

### 8.4 DeepSeek AI 財務顧問

```typescript
// 服務檔案: services/deepseekService.ts
// 端點: /api/deepseek (Vite proxy → api.deepseek.com)

async function getTianJiAdvice(
  data: AnalysisResult,
  stocks: StockPosition[],
  cryptos: CryptoPosition[],
  customPersona?: string,
  userQuestion?: string
): Promise<string>;
```

### 8.5 八字計算服務 (lunar-javascript)

```typescript
// 服務檔案: services/baziService.ts
// 使用套件: lunar-javascript (by 6tail)

interface BirthInfo {
  year: number;   // 西曆年
  month: number;  // 1-12
  day: number;    // 1-31
  hour: number;   // 0-23
}

interface BaZiResult {
  yearPillar: { gan: string; zhi: string; ganZhi: string };
  monthPillar: { gan: string; zhi: string; ganZhi: string };
  dayPillar: { gan: string; zhi: string; ganZhi: string };
  hourPillar: { gan: string; zhi: string; ganZhi: string };
  dayMaster: string;
  dayMasterElement: string;
  zodiac: string;
  wuXingCount: Record<string, number>;
  lunarDate: string;
  formatted: string;
}

function calculateBaZi(birth: BirthInfo): BaZiResult;
function getTodayBaZi(): string;
```

---

## 9. 本地資料庫 (IndexedDB)

使用 IndexedDB 作為主要本地儲存，比 localStorage 更穩定可靠。

### 9.1 資料庫配置

```typescript
// 服務檔案: services/dbService.ts

const DB_NAME = 'TianJiDB';
const DB_VERSION = 1;
```

### 9.2 Object Stores

| Store 名稱 | keyPath | 說明 |
|-----------|---------|------|
| `settings` | `id` | 全域設定 (固定 key: 'main') |
| `stockPositions` | `id` | 台股部位陣列 |
| `usStockPositions` | `id` | 美股部位陣列 |
| `cryptoData` | `id` | 加密貨幣狀態 (固定 key: 'main') |
| `debts` | `id` | 負債項目陣列 |
| `meta` | `key` | 元數據 (lastUpdated 等) |

### 9.3 公開 API

```typescript
interface AppData {
  settings: GlobalSettings;
  stockPositions: StockPosition[];
  usStockPositions: USStockPosition[];
  cryptoData: CryptoState;
  debts: DebtItem[];
}

// 儲存完整應用狀態
async function saveAppData(data: AppData): Promise<void>;

// 讀取完整應用狀態 (自動從 localStorage 遷移)
async function loadAppData(): Promise<AppData>;

// 匯出資料為 JSON (備份)
async function exportData(): Promise<string>;

// 匯入 JSON 資料 (還原)
async function importData(jsonString: string): Promise<void>;

// 清除所有資料 (危險)
async function clearAllData(): Promise<void>;
```

### 9.4 資料遷移策略

1. 優先從 IndexedDB 讀取
2. 若 IndexedDB 為空，自動從 localStorage 遷移
3. 同時保留 localStorage 備份 (雙寫)

---

## 10. localStorage Keys (備份用途)

| Key | 型別 | 說明 |
|-----|------|------|
| `tianji_data_v2` | JSON | 主要數據備份 |
| `tianji_data_v1` | JSON | 舊版數據 (遷移來源) |
| `tianji_custom_persona` | string | AI 自訂人設 |
| `tianji_birth_info` | JSON | 用戶生辰資料 |

---

## 11. Vite Proxy 設定

```typescript
// vite.config.ts
proxy: {
  '/api/deepseek': { target: 'https://api.deepseek.com' },
  '/api/twse': { target: 'https://mis.twse.com.tw' },
  '/api/max': { target: 'https://max-api.maicoin.com' },
  '/api/binance': { target: 'https://api.binance.com' },
  '/api/yahoo': { 
    target: 'https://query1.finance.yahoo.com/v8/finance/chart',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  },
}
```

---

## 12. 外部 API 服務 🆕

### 12.1 USD/TWD 匯率 API

- **服務檔案**: `services/exchangeRateService.ts`
- **API**: [ExchangeRate-API](https://open.er-api.com/v6/latest/USD)
- **需要 API Key**: ❌ 不需要
- **更新頻率**: 每日更新
- **速率限制**: 無明確限制

```typescript
import { getUsdTwdRate } from './services/exchangeRateService';

const rate = await getUsdTwdRate(); // 回傳 number | null
```

### 12.2 美股報價 API

- **服務檔案**: `services/yahooFinanceService.ts`
- **API**: Yahoo Finance (非官方)
- **需要 API Key**: ❌ 不需要
- **透過 Vite Proxy**: `/api/yahoo/{symbol}`

```typescript
import { getUSStockPrice, getUSStockPrices } from './services/yahooFinanceService';

const price = await getUSStockPrice('AAPL');
const prices = await getUSStockPrices(['AAPL', 'NVDA', 'TSLA']);
```

---

## 13. 新增計算指標 🆕

### 13.1 資金運用率

衡量某資產類別佔可用資金的比例。

```typescript
// 台股運用率
stockUtilization = stockMarketValue / (cashTwd + stockMarketValue)

// 美股運用率
usStockUtilization = usStockMarketValue / (cashUsd + usStockMarketValue)

// 幣圈運用率
cryptoUtilization = cryptoPositionSize / (walletBalance + cryptoPositionSize)
```

### 13.2 真實總獲利

```typescript
// 原始本金 (換算 TWD)
originalCapitalTotal = originalCapitalTwd 
                     + (originalCapitalUsd * usdTwdRate) 
                     + (originalCapitalUsdt * usdtTwdRate)

// 真實總獲利
totalProfit = netWorth - originalCapitalTotal
profitPercent = (totalProfit / originalCapitalTotal) * 100
```

---

## 14. 每日快照 (DailySnapshot) 🆕

用於記錄每日資產狀態，支援歷史走勢追蹤。

### 快照規則

| 規則 | 說明 |
|------|------|
| **ID 格式** | `YYYY-MM-DD-HH:mm:ss`（當天）或 `YYYY-MM-DD`（歷史） |
| **每日上限** | 最多 5 筆，超過會刪除最舊 |
| **隔天清理** | 只保留最新一筆，ID 簡化為 `YYYY-MM-DD` |

```typescript
interface DailySnapshot {
  id: string;           // YYYY-MM-DD-HH:mm:ss 或 YYYY-MM-DD
  timestamp: number;    // Unix timestamp
  netWorth: number;     // 總淨值 (TWD)
  grossAssets: number;  // 總資產
  totalDebt: number;    // 總負債
  
  // 各類資產明細
  stockValue: number;   // 台股市值
  usStockValue: number; // 美股市值 (TWD)
  cryptoValue: number;  // 幣圈市值 (TWD)
  cashTwd: number;
  cashUsd: number;
  
  // 獲利追蹤
  totalPnl: number;
  pnlPercent: number;
  
  // 槓桿與運用率
  realLeverage: number;
  stockUtilization: number;
  usStockUtilization: number;
  cryptoUtilization: number;
}
```

---

## 15. 目標 (Goal) 🆕

```typescript
interface Goal {
  id: string;
  name: string;         // 如: "第一桶金"
  targetAmount: number; // 目標金額 (TWD)
  deadline?: string;
  createdAt: string;
  achievedAt?: string;
}
```

---

## 16. 歷史服務 (historyService.ts) 🆕

| 函數 | 說明 |
|------|------|
| `saveSnapshot(snapshot)` | 儲存快照（每日最多 5 筆） |
| `getSnapshots()` | 取得所有快照 |
| `shouldTakeSnapshot()` | 檢查是否需要快照 (4PM-9AM) |
| `getWaveAnalysis()` | 波段分析 (高低點、位置) |
| `cleanupOldSnapshots()` | 清理過去日期的多餘快照 |
| `getGoals()` / `addGoal()` / `deleteGoal()` | 目標管理 |

---

## 17. localStorage Keys 🆕

| Key | 用途 | 生命週期 |
|-----|------|----------|
| `tianji_history_v1` | 快照、目標資料 | 永久 |
| `tianji_goalLines` | 目標線開關狀態 | Session |
| `tianji_timeRange` | 時間區間設定 | Session |
| `tianji_dashboard_order` | 儀表板組件排序 🆕 | 永久 |
