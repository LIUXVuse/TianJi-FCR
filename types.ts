// ==========================================
// 台股 (Taiwan Stock)
// ==========================================
export interface StockPosition {
  id: string;
  name: string;
  costPrice: number; // 成本價 (Purchase Price)
  price: number;     // 現價 (Current Price)
  shares: number;    // 單位：股 (Shares)

  // --- 融資/質押邏輯 ---
  isMargin: boolean; // 是否使用融資 (Margin Trading)
  // 如果 isMargin = true, 則 loanAmount = costPrice * shares * 0.6 (自備4成, 借6成)
  // 如果 isMargin = false, 則看 pledgeRate (質押)

  pledgeRate: number; // 質押成數 (0-100%)
  loanAmount: number; // 融資/質押金額 (TWD)
}

// ==========================================
// 美股 (US Stock)
// ==========================================
export interface USStockPosition {
  id: string;
  symbol: string;      // e.g., AAPL, TSLA, NVDA
  name: string;        // 公司名稱
  costPrice: number;   // 成本價 (USD)
  price: number;       // 現價 (USD)
  shares: number;      // 股數 (可小數，支援零股)

  // --- Margin 槓桿 (美股 Reg T 規則: 最高借50%) ---
  isMargin: boolean;   // 是否使用 Margin
  marginRatio: number; // 借款比例 (0-50%)
  loanAmount: number;  // 借款金額 (USD)

  // --- 計算欄位 ---
  marketValue: number; // 市值 = price * shares (USD)
  pnl: number;         // 損益 (USD)
  pnlPercent: number;  // 損益率 (%)
}

export interface USStockState {
  positions: USStockPosition[];
}

// ==========================================
// 加密貨幣 (Crypto)
// ==========================================
export type CryptoType = 'SPOT' | 'FUTURE'; // 現貨 or 合約

export interface CryptoPosition {
  id: string;
  type: CryptoType; // 類型區分
  symbol: string;   // e.g., BTCUSDT, ETHUSDT

  // --- 合約專用 ---
  leverage: number; // 槓桿 (現貨固定為1)
  margin: number;   // 本金 (USDT) - 合約用
  liquidationPrice?: number; // 強平價格 (用戶可選輸入，Cross Margin 需手動填)

  // --- 現貨專用 ---
  units: number;    // 顆數 (Units/Coins) - 現貨用 (e.g. 0.5 BTC)

  entryPrice: number;   // 平均成本 (均價)
  currentPrice: number; // 現價

  // --- 計算欄位 ---
  positionSize: number; // 倉位價值 (Notional Value)
  pnl: number;          // 損益 (USDT)
  pnlPercent: number;   // 損益率 (%)
}

export interface CryptoState {
  walletBalance: number; // 可用餘額 (Free USDT, 不含保證金)
  positions: CryptoPosition[];
}

// ==========================================
// 負債 (Debts/Liabilities)
// ==========================================
export interface DebtItem {
  id: string;
  type: 'credit' | 'mortgage' | 'car' | 'other'; // 信貸、房貸、車貸、其他
  name: string;           // 名稱說明
  principalAmount: number; // 本金 (TWD)
  outstandingAmount: number; // 尚欠金額 (TWD)
  monthlyPayment: number;  // 每月還款 (TWD)
  interestRate: number;    // 年利率 (%)
}

export interface DebtState {
  debts: DebtItem[];
  totalDebt: number; // 總負債 (TWD)
}

// ==========================================
// 全域設定 (Global Settings)
// ==========================================
export interface GlobalSettings {
  usdtTwdRate: number;  // USDT/TWD 匯率
  usdTwdRate: number;   // USD/TWD 匯率 (美金)
  cashTwd: number;      // 台幣現金部位
  cashUsd: number;      // 美金現金部位 (USD)

  // 原始本金 (用於計算真實總獲利)
  originalCapitalTwd: number;  // 原始台幣本金
  originalCapitalUsd: number;  // 原始美金本金
  originalCapitalUsdt: number; // 原始 USDT 本金
}

// ==========================================
// 分析結果 (Analysis Result)
// ==========================================
export interface AnalysisResult {
  // --- 總覽 ---
  netWorth: number;      // 總淨值 (扣除負債)
  grossAssets: number;   // 總資產 (不扣負債)
  totalDebt: number;     // 總負債
  totalExposure: number; // 總曝險

  // --- 融資槓桿 (有沒有借錢) ---
  realLeverage: number;    // 1. 真實槓桿 (總曝險/淨值)
  stockLeverage: number;   // 2. 台股槓桿 (市值/淨權益)
  usStockLeverage: number; // 3. 美股槓桿
  cryptoLeverage: number;  // 4. 幣圈槓桿

  // --- 資金運用率 (投入多少資金) 🆕 ---
  stockUtilization: number;   // 台股運用率 (市值 / 台幣現金+市值)
  usStockUtilization: number; // 美股運用率 (市值 / 美金現金+市值)
  cryptoUtilization: number;  // 幣圈運用率 (倉位 / 閒置U+倉位)

  // --- 台股 ---
  stockMaintenanceRate: number | null;
  totalStockPnL: number;
  totalStockPnLPercent: number;

  // --- 美股 ---
  totalUSStockPnL: number;     // 美股損益 (USD)
  totalUSStockPnLPercent: number;

  // --- 幣圈 ---
  totalCryptoPnL: number;      // 幣圈損益 (TWD)
  totalCryptoPnLPercent: number;
}

// ==========================================
// 計算明細 (Calculation Breakdown)
// ==========================================
export interface CalculationBreakdown {
  // --- 資產 ---
  cashTwd: number;           // 台幣現金
  cashUsdTwd: number;        // 美金現金 (換算TWD) 🆕
  stockEquityTwd: number;    // 台股淨權益 (市值 - 融資)
  usStockEquityTwd: number;  // 美股淨值 (換算TWD)
  cryptoEquityTwd: number;   // 幣圈淨值 (換算TWD)
  grossAssetsTwd: number;    // 總資產

  // --- 負債 ---
  stockLoanTwd: number;      // 台股融資金額
  usStockLoanTwd: number;    // 美股 Margin 借款 (換算TWD) 🆕
  totalDebtTwd: number;      // 信貸+房貸+車貸
  totalLiabilities: number;  // 總負債 (融資+Margin+其他負債)

  // --- 曝險 ---
  stockExposureTwd: number;  // 台股曝險 (市值)
  usStockExposureTwd: number; // 美股曝險 (換算TWD)
  cryptoExposureTwd: number; // 幣圈曝險 (換算TWD)
  totalExposure: number;     // 總曝險

  // --- 計算結果 ---
  netWorth: number;          // 淨值 = 總資產 - 總負債
  realLeverage: number;      // 槓桿 = 總曝險 / 淨值
}

// ==========================================
// 風險等級 (Risk Level)
// ==========================================
export enum RiskLevel {
  SAFE = 'SAFE',       // 槓桿 < 1.5
  WARNING = 'WARNING', // 槓桿 1.5 - 2.5
  DANGER = 'DANGER',   // 槓桿 > 2.5
}

// ==========================================
// 每日快照 (Daily Snapshot)
// ==========================================
export interface DailySnapshot {
  id: string;           // YYYY-MM-DD 格式
  timestamp: number;    // Unix timestamp
  netWorth: number;     // 總淨值 (TWD)
  grossAssets: number;  // 總資產
  totalDebt: number;    // 總負債

  // 各類資產明細
  stockValue: number;   // 台股市值
  usStockValue: number; // 美股市值 (TWD 換算)
  cryptoValue: number;  // 幣圈市值 (TWD 換算)
  cashTwd: number;      // 台幣現金
  cashUsd: number;      // 美金現金

  // 獲利追蹤
  totalPnl: number;     // 總獲利
  pnlPercent: number;   // 獲利百分比

  // 槓桿與運用率
  realLeverage: number;
  stockUtilization: number;
  usStockUtilization: number;
  cryptoUtilization: number;
}

// ==========================================
// 目標 (Goal)
// ==========================================
export interface Goal {
  id: string;
  name: string;         // 目標名稱 (如: "第一桶金")
  targetAmount: number; // 目標金額 (TWD)
  deadline?: string;    // 目標日期 (可選)
  createdAt: string;
  achievedAt?: string;  // 達成日期
}

// ==========================================
// 歷史紀錄狀態 (History State)
// ==========================================
export interface HistoryState {
  snapshots: DailySnapshot[];
  goals: Goal[];
  lastSnapshotDate: string; // YYYY-MM-DD
}
