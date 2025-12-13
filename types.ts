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
  cashTwd: number;      // 台幣現金
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

  // --- 槓桿四兄弟 ---
  realLeverage: number;    // 1. 總資產槓桿 (曝險/淨值)
  stockLeverage: number;   // 2. 台股槓桿
  usStockLeverage: number; // 3. 美股槓桿 (通常為1，除非有融資)
  cryptoLeverage: number;  // 4. 幣圈槓桿

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
  stockEquityTwd: number;    // 台股淨權益 (市值 - 融資)
  usStockEquityTwd: number;  // 美股淨值 (換算TWD)
  cryptoEquityTwd: number;   // 幣圈淨值 (換算TWD)
  grossAssetsTwd: number;    // 總資產

  // --- 負債 ---
  stockLoanTwd: number;      // 台股融資金額
  totalDebtTwd: number;      // 信貸+房貸+車貸
  totalLiabilities: number;  // 總負債 (融資+其他負債)

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
