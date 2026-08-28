import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StockSection } from './components/StockSection';
import { CryptoSection } from './components/CryptoSection';
import { USStockSection } from './components/USStockSection';
import { DebtSection } from './components/DebtSection';
import { CalculationBreakdown } from './components/CalculationBreakdown';
import { HistoryPage } from './components/HistoryPage';
import { QuantPage } from './components/QuantPage';
import { AllocationChart } from './components/AllocationChart';
import { DraggableDashboard } from './components/DraggableDashboard';
import { StockPosition, CryptoState, GlobalSettings, AnalysisResult, USStockPosition, DebtItem, DailySnapshot } from './types';
import { Settings, ShieldAlert, BadgeDollarSign, Activity, TrendingUp, Bitcoin, Info, RefreshCw, MessageSquare, X, Calendar, DollarSign, CreditCard, BarChart3, Camera, Cloud, CloudOff } from 'lucide-react';
import { getTianJiAdvice, DEFAULT_PERSONA, getCustomPersona, saveCustomPersona } from './services/deepseekService';
import { getUsdtTwdRate } from './services/maxService';
import { getUsdTwdRate } from './services/exchangeRateService';
import { saveSnapshot, shouldTakeSnapshot, getTodayString, getHistory, saveHistory } from './services/historyService';
import { calculateBaZi, getBirthInfo, saveBirthInfo, BirthInfo, BaZiResult } from './services/baziService';
import { extractStockCode, getStockPrice } from './services/twseService';
import { getUSStockPrices } from './services/yahooFinanceService';
import { getPrice as getCryptoPrice } from './services/binanceService';
import {
  loadAllFromCloud,
  saveAllToCloud,
  testConnection,
  saveSettingsToCloud,
  saveStockPositionsToCloud,
  saveUSStockPositionsToCloud,
  saveCryptoPositionsToCloud,
  saveDebtsToCloud,
  saveSnapshotsToCloud,
  saveGoalsToCloud,
  CloudData
} from './services/supabaseService';

const STORAGE_KEY_V1 = 'tianji_data_v1';
const STORAGE_KEY_V2 = 'tianji_data_v2';

// 資料遷移：從 v1 遷移到 v2
const migrateData = () => {
  if (typeof window === 'undefined') return null;

  // 先嘗試讀取 v2
  const v2Data = localStorage.getItem(STORAGE_KEY_V2);
  if (v2Data) {
    try {
      return JSON.parse(v2Data);
    } catch (e) {
      console.error("讀取 v2 存檔失敗", e);
    }
  }

  // v2 不存在，嘗試從 v1 遷移
  const v1Data = localStorage.getItem(STORAGE_KEY_V1);
  if (v1Data) {
    try {
      const parsed = JSON.parse(v1Data);
      console.log("📦 從 v1 遷移資料到 v2...");

      // 補充 v2 新欄位的預設值
      const migratedData = {
        ...parsed,
        usStockPositions: parsed.usStockPositions || [],
        debts: parsed.debts || [],
        settings: {
          ...parsed.settings,
          usdTwdRate: parsed.settings?.usdTwdRate || 31.5,
        }
      };

      // 儲存到 v2
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migratedData));
      console.log("✅ 資料遷移完成！");

      return migratedData;
    } catch (e) {
      console.error("遷移 v1 資料失敗", e);
    }
  }

  return {};
};

// Helper to load data synchronously to prevent overwriting on initial render
const loadSavedData = () => {
  return migrateData() || {};
};

const App: React.FC = () => {
  const savedData = loadSavedData();

  // 是否已從 IndexedDB 載入
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // --- Global Settings (Lazy Init) ---
  const [settings, setSettings] = useState<GlobalSettings>(() =>
    savedData.settings || {
      usdtTwdRate: 31.3,
      usdTwdRate: 31.5,
      cashTwd: 0,
      cashUsd: 0,
      originalCapitalTwd: 0,
      originalCapitalUsd: 0,
      originalCapitalUsdt: 0
    }
  );

  // --- Assets State (Lazy Init) ---
  const [stockPositions, setStockPositions] = useState<StockPosition[]>(() =>
    savedData.stockPositions || []
  );

  const [usStockPositions, setUSStockPositions] = useState<USStockPosition[]>(() =>
    savedData.usStockPositions || []
  );

  const [cryptoData, setCryptoData] = useState<CryptoState>(() =>
    savedData.cryptoData || { walletBalance: 0, positions: [] }
  );

  const [debts, setDebts] = useState<DebtItem[]>(() =>
    savedData.debts || []
  );

  // --- IndexedDB 初始載入 ---
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const { loadAppData } = await import('./services/dbService');
        const data = await loadAppData();

        // 只有在 IndexedDB 有資料時才覆蓋
        if (data.stockPositions.length > 0 || data.cryptoData.positions.length > 0 || data.settings.cashTwd > 0) {
          setSettings(data.settings);
          setStockPositions(data.stockPositions);
          setUSStockPositions(data.usStockPositions);
          setCryptoData(data.cryptoData);
          setDebts(data.debts);
          console.log('📂 從 IndexedDB 載入資料完成');
        }
        setIsDbLoaded(true);
      } catch (error) {
        console.error('IndexedDB 載入失敗，使用 localStorage:', error);
        setIsDbLoaded(true);
      }
    };
    loadFromDB();
  }, []);

  // --- Persistence Logic (雙寫: IndexedDB + localStorage) ---
  useEffect(() => {
    if (!isDbLoaded) return; // 等待 IndexedDB 載入完成

    const dataToSave = {
      settings,
      stockPositions,
      usStockPositions,
      cryptoData,
      debts
    };

    // 同步寫入 localStorage (快速)
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(dataToSave));

    // 非同步寫入 IndexedDB (可靠)
    import('./services/dbService').then(({ saveAppData }) => {
      saveAppData(dataToSave).catch(err => console.error('IndexedDB 儲存失敗:', err));
    });

  }, [settings, stockPositions, usStockPositions, cryptoData, debts, isDbLoaded]);


  // --- Calculated Results ---
  const [results, setResults] = useState<AnalysisResult>({
    netWorth: 0,
    grossAssets: 0,
    totalDebt: 0,
    totalExposure: 0,
    realLeverage: 0,
    stockLeverage: 1,
    usStockLeverage: 1,
    cryptoLeverage: 0,
    stockUtilization: 0,      // 🆕 資金運用率
    usStockUtilization: 0,    // 🆕
    cryptoUtilization: 0,     // 🆕
    stockMaintenanceRate: null,
    totalStockPnL: 0,
    totalStockPnLPercent: 0,
    totalUSStockPnL: 0,
    totalUSStockPnLPercent: 0,
    totalCryptoPnL: 0,
    totalCryptoPnLPercent: 0
  });

  // 計算明細數據
  const [breakdown, setBreakdown] = useState({
    cashTwd: 0,
    cashUsdTwd: 0,           // 🆕 美金現金換算
    stockEquityTwd: 0,
    usStockEquityTwd: 0,
    cryptoEquityTwd: 0,
    grossAssetsTwd: 0,
    stockLoanTwd: 0,
    usStockLoanTwd: 0,       // 🆕 美股 Margin 借款
    totalDebtTwd: 0,
    totalLiabilities: 0,
    stockExposureTwd: 0,
    usStockExposureTwd: 0,
    cryptoExposureTwd: 0,
    totalExposure: 0,
    netWorth: 0,
    realLeverage: 0
  });

  const [tianJiMessage, setTianJiMessage] = useState<string>("施主，數據金剛不壞，請安心使用...");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingRate, setIsRefreshingRate] = useState(false);

  // 頁面切換
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'history' | 'quant'>('dashboard');

  // 歷史紀錄刷新觸發器
  const [historyLastUpdated, setHistoryLastUpdated] = useState(Date.now());

  // 全局刷新狀態
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);

  // 雲端同步狀態
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'synced' | 'error'>('idle');

  // AI 設定
  const [showAISettings, setShowAISettings] = useState(false);
  const [customPersona, setCustomPersona] = useState<string>(() => getCustomPersona() || '');
  const [userQuestion, setUserQuestion] = useState<string>('');

  // 八字設定
  const [birthInfo, setBirthInfo] = useState<BirthInfo | null>(() => getBirthInfo());
  const [baziResult, setBaziResult] = useState<BaZiResult | null>(null);
  const [birthYear, setBirthYear] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthHour, setBirthHour] = useState<string>('12');

  // 初始化八字計算
  useEffect(() => {
    if (birthInfo) {
      setBirthYear(birthInfo.year.toString());
      setBirthMonth(birthInfo.month.toString());
      setBirthDay(birthInfo.day.toString());
      setBirthHour(birthInfo.hour.toString());
      setBaziResult(calculateBaZi(birthInfo));
    }
  }, []);

  // --- Core Calculation Logic ---
  useEffect(() => {
    const usdRate = settings.usdTwdRate || 31.5;

    // ==========================================
    // 1. Taiwan Stock Math
    // ==========================================
    const stockMarketValue = stockPositions.reduce((acc, p) => acc + (p.price * p.shares), 0);
    const stockCostValue = stockPositions.reduce((acc, p) => acc + (p.costPrice * p.shares), 0);
    const stockLoan = stockPositions.reduce((acc, p) => acc + p.loanAmount, 0);
    const stockNetEquity = stockMarketValue - stockLoan;

    // 融資槓桿 = 市值 / 淨權益
    const stockLeverage = stockNetEquity > 0 ? stockMarketValue / stockNetEquity : (stockMarketValue > 0 ? 999 : 1);
    // 資金運用率 = 市值 / (現金 + 市值)
    const stockUtilization = (stockMarketValue + settings.cashTwd) > 0
      ? stockMarketValue / (stockMarketValue + settings.cashTwd)
      : 0;

    const maintenanceRate = stockLoan > 0 ? (stockMarketValue / stockLoan) * 100 : null;
    const stockPnL = stockMarketValue - stockCostValue;
    const stockPnLPercent = stockCostValue > 0 ? (stockPnL / stockCostValue) * 100 : 0;

    // ==========================================
    // 2. US Stock Math
    // ==========================================
    const usStockMarketValue_USD = usStockPositions.reduce((acc, p) => acc + p.marketValue, 0);
    const usStockCostValue_USD = usStockPositions.reduce((acc, p) => acc + (p.costPrice * p.shares), 0);
    const usStockLoan_USD = usStockPositions.reduce((acc, p) => acc + (p.loanAmount || 0), 0);
    const usStockPnL_USD = usStockPositions.reduce((acc, p) => acc + p.pnl, 0);
    const usStockPnLPercent = usStockCostValue_USD > 0 ? (usStockPnL_USD / usStockCostValue_USD) * 100 : 0;

    const usStockNetEquity_USD = usStockMarketValue_USD - usStockLoan_USD;
    const usStockEquityTwd = usStockNetEquity_USD * usdRate;
    const usStockExposureTwd = usStockMarketValue_USD * usdRate;
    const usStockLoanTwd = usStockLoan_USD * usdRate;

    // 美股融資槓桿
    const usStockLeverage = usStockNetEquity_USD > 0 ? usStockMarketValue_USD / usStockNetEquity_USD : (usStockMarketValue_USD > 0 ? 999 : 1);
    // 美股資金運用率 = 市值 / (美金現金 + 市值)
    const usStockUtilization = (usStockMarketValue_USD + (settings.cashUsd || 0)) > 0
      ? usStockMarketValue_USD / (usStockMarketValue_USD + (settings.cashUsd || 0))
      : 0;

    // 美金現金換算 TWD
    const cashUsdTwd = (settings.cashUsd || 0) * usdRate;

    // ==========================================
    // 3. Crypto Math
    // ==========================================
    let cryptoCostBasis_USDT = 0;
    let cryptoTotalPnL_USDT = 0;
    let cryptoTotalPositionSize_USDT = 0;

    (cryptoData.positions || []).forEach(p => {
      if (p.type === 'SPOT') {
        const spotValue = p.units * p.currentPrice;
        const spotCost = p.units * p.entryPrice;
        cryptoCostBasis_USDT += spotCost;
        cryptoTotalPositionSize_USDT += spotValue;
        cryptoTotalPnL_USDT += p.pnl;
      } else {
        cryptoCostBasis_USDT += p.margin;
        cryptoTotalPositionSize_USDT += (p.margin * p.leverage);
        cryptoTotalPnL_USDT += p.pnl;
      }
    });

    const cryptoNetEquity_USDT = cryptoData.walletBalance + cryptoCostBasis_USDT + cryptoTotalPnL_USDT;
    const cryptoNetEquityTwd = cryptoNetEquity_USDT * settings.usdtTwdRate;
    const cryptoExposureTwd = cryptoTotalPositionSize_USDT * settings.usdtTwdRate;

    // 幣圈槓桿
    const cryptoLeverage = cryptoNetEquity_USDT > 0 ? cryptoTotalPositionSize_USDT / cryptoNetEquity_USDT : (cryptoTotalPositionSize_USDT > 0 ? 999 : 0);
    // 幣圈資金運用率 = 倉位 / (閒置U + 倉位)
    const cryptoUtilization = (cryptoTotalPositionSize_USDT + cryptoData.walletBalance) > 0
      ? cryptoTotalPositionSize_USDT / (cryptoTotalPositionSize_USDT + cryptoData.walletBalance)
      : 0;

    const cryptoPnL_TWD = cryptoTotalPnL_USDT * settings.usdtTwdRate;
    const cryptoPnLPercent = cryptoCostBasis_USDT > 0 ? (cryptoTotalPnL_USDT / cryptoCostBasis_USDT) * 100 : 0;

    // ==========================================
    // 4. Debt Math
    // ==========================================
    const totalDebtAmount = debts.reduce((acc, d) => acc + d.outstandingAmount, 0);

    // ==========================================
    // 5. Total Portfolio Math
    // ==========================================
    // 總資產 = 台幣現金 + 美金現金(換算) + 台股市值 + 美股市值 + 幣圈淨權益
    // 注意：台股/美股用「市值」（不扣融資/Margin），融資列在負債端
    const grossAssets = settings.cashTwd + cashUsdTwd + stockMarketValue + usStockExposureTwd + cryptoNetEquityTwd;
    // 總負債 = 台股融資 + 美股Margin + 信貸等
    const totalLiabilities = stockLoan + usStockLoanTwd + totalDebtAmount;
    // 淨值 = 總資產 - 總負債 (公式一致，融資在負債端扣一次)
    const totalNetWorth = grossAssets - totalLiabilities;
    // 總曝險 = 台股市值 + 美股市值 + 幣圈倉位
    const totalExposure = stockMarketValue + usStockExposureTwd + cryptoExposureTwd;
    // 真實槓桿 = 總曝險 / 淨值
    const realLeverage = totalNetWorth > 0 ? totalExposure / totalNetWorth : 0;

    // ==========================================
    // 更新結果
    // ==========================================
    setResults({
      netWorth: totalNetWorth,
      grossAssets: grossAssets,
      totalDebt: totalDebtAmount + stockLoan + usStockLoanTwd, // 包含融資
      totalExposure: totalExposure,
      realLeverage: realLeverage,
      stockLeverage: stockLeverage,
      usStockLeverage: usStockLeverage,
      cryptoLeverage: cryptoLeverage,
      stockUtilization: stockUtilization,
      usStockUtilization: usStockUtilization,
      cryptoUtilization: cryptoUtilization,
      stockMaintenanceRate: maintenanceRate,
      totalStockPnL: stockPnL,
      totalStockPnLPercent: stockPnLPercent,
      totalUSStockPnL: usStockPnL_USD,
      totalUSStockPnLPercent: usStockPnLPercent,
      totalCryptoPnL: cryptoPnL_TWD,
      totalCryptoPnLPercent: cryptoPnLPercent
    });

    // ==========================================
    // 更新計算明細
    // ==========================================
    setBreakdown({
      cashTwd: settings.cashTwd,
      cashUsdTwd: cashUsdTwd,
      stockEquityTwd: stockNetEquity,
      usStockEquityTwd: usStockEquityTwd,
      cryptoEquityTwd: cryptoNetEquityTwd,
      grossAssetsTwd: grossAssets,
      stockLoanTwd: stockLoan,
      usStockLoanTwd: usStockLoanTwd,
      totalDebtTwd: totalDebtAmount,
      totalLiabilities: totalLiabilities,
      stockExposureTwd: stockMarketValue,
      usStockExposureTwd: usStockExposureTwd,
      cryptoExposureTwd: cryptoExposureTwd,
      totalExposure: totalExposure,
      netWorth: totalNetWorth,
      realLeverage: realLeverage
    });

  }, [stockPositions, usStockPositions, cryptoData, settings, debts]);

  // --- 建立快照 ---
  const createSnapshot = useCallback(() => {
    const snapshot: DailySnapshot = {
      id: getTodayString(),
      timestamp: Date.now(),
      netWorth: results.netWorth,
      grossAssets: results.grossAssets,
      totalDebt: results.totalDebt,
      stockValue: breakdown.stockEquityTwd,
      usStockValue: breakdown.usStockEquityTwd,
      cryptoValue: breakdown.cryptoEquityTwd,
      cashTwd: settings.cashTwd,
      cashUsd: settings.cashUsd || 0,
      totalPnl: results.totalStockPnL + (results.totalUSStockPnL * (settings.usdTwdRate || 31.5)) + results.totalCryptoPnL,
      pnlPercent: 0, // TODO: 計算總獲利百分比
      realLeverage: results.realLeverage,
      stockUtilization: results.stockUtilization,
      usStockUtilization: results.usStockUtilization,
      cryptoUtilization: results.cryptoUtilization
    };

    saveSnapshot(snapshot);
    console.log('📸 手動快照完成:', snapshot.id);
  }, [results, breakdown, settings]);

  // --- 自動快照檢查 (每次計算完成後) ---
  useEffect(() => {
    if (results.netWorth > 0 && shouldTakeSnapshot()) {
      createSnapshot();
    }
  }, [results, createSnapshot]);

  // --- 全局刷新 (刷新所有 API + 快照) ---
  const handleGlobalRefresh = async () => {
    setIsGlobalRefreshing(true);
    console.log('🔄 開始全局刷新...');

    try {
      // 1. 刷新 USDT 匯率 (回傳物件，取 .last)
      const usdtRateData = await getUsdtTwdRate();
      if (usdtRateData && usdtRateData.last) {
        setSettings(s => ({ ...s, usdtTwdRate: usdtRateData.last }));
        console.log('✅ USDT 匯率已更新:', usdtRateData.last);
      }

      // 2. 刷新 USD 匯率 (回傳數字)
      const usdRate = await getUsdTwdRate();
      if (usdRate) {
        setSettings(s => ({ ...s, usdTwdRate: usdRate }));
        console.log('✅ USD 匯率已更新:', usdRate);
      }

      // 3. 刷新台股價格
      if (stockPositions.length > 0) {
        console.log('📈 刷新台股價格...');
        const updatedStocks = await Promise.all(
          stockPositions.map(async (stock) => {
            const code = extractStockCode(stock.name);
            if (!code) return stock;

            const priceData = await getStockPrice(code);
            if (priceData && priceData.price > 0) {
              // 融資：重算借款（鎖定成本）；質押：loanAmount 固定不動
              const loanAmount = stock.isMargin
                ? stock.costPrice * stock.shares * 0.6
                : stock.loanAmount;

              return {
                ...stock,
                price: priceData.price,
                loanAmount
              };
            }
            return stock;
          })
        );
        setStockPositions(updatedStocks);
        console.log('✅ 台股價格已更新');
      }

      // 4. 刷新美股價格
      if (usStockPositions.length > 0) {
        console.log('💵 刷新美股價格...');
        const symbols = usStockPositions.map(p => p.symbol);
        const pricesMap = await getUSStockPrices(symbols);

        const updatedUSStocks = usStockPositions.map(stock => {
          const newPrice = pricesMap[stock.symbol];
          if (newPrice && newPrice > 0) {
            const marketValue = newPrice * stock.shares;
            const pnl = (newPrice - stock.costPrice) * stock.shares;
            const pnlPercent = stock.costPrice > 0 ? ((newPrice - stock.costPrice) / stock.costPrice) * 100 : 0;

            return {
              ...stock,
              price: newPrice,
              marketValue,
              pnl,
              pnlPercent
            };
          }
          return stock;
        });
        setUSStockPositions(updatedUSStocks);
        console.log('✅ 美股價格已更新');
      }

      // 5. 刷新幣圈價格 (需要同時更新 pnl, pnlPercent, positionSize)
      if (cryptoData.positions && cryptoData.positions.length > 0) {
        console.log('₿ 刷新幣圈價格...');
        const updatedPositions = await Promise.all(
          cryptoData.positions.map(async (pos) => {
            const newPrice = await getCryptoPrice(pos.symbol);
            if (newPrice && newPrice > 0) {
              // 重新計算 PnL (與 CryptoSection 的邏輯一致)
              const amount = pos.type === 'SPOT' ? pos.units : pos.margin;
              const leverage = pos.type === 'SPOT' ? 1 : pos.leverage;
              const entry = pos.entryPrice;

              let pnl = 0;
              let pnlPercent = 0;
              let positionSize = 0;

              if (pos.type === 'SPOT') {
                pnl = (newPrice - entry) * amount;
                positionSize = amount * newPrice;
                const costBasis = amount * entry;
                pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
              } else {
                const rawPercent = entry > 0 ? (newPrice - entry) / entry : 0;
                pnlPercent = rawPercent * leverage * 100;
                pnl = amount * (pnlPercent / 100);
                positionSize = amount * leverage;
              }

              return {
                ...pos,
                currentPrice: newPrice,
                positionSize,
                pnl,
                pnlPercent
              };
            }
            return pos;
          })
        );
        setCryptoData(prev => ({ ...prev, positions: updatedPositions }));
        console.log('✅ 幣圈價格已更新');
      }

      // 6. 等待一下讓計算完成
      await new Promise(r => setTimeout(r, 500));

      // 7. 快照
      createSnapshot();

      console.log('✅ 全局刷新完成');
    } catch (error) {
      console.error('全局刷新失敗:', error);
    } finally {
      setIsGlobalRefreshing(false);
    }
  };

  // --- 雲端同步 ---
  const handleCloudUpload = async () => {
    setIsCloudSyncing(true);
    setCloudStatus('idle');
    try {
      console.log('☁️ 開始上傳到雲端...');

      // 取得歷史資料（快照與目標）
      const history = getHistory();

      // 儲存設定（含 walletBalance）
      await saveSettingsToCloud(settings, cryptoData.walletBalance);

      // 儲存各類持倉
      await saveStockPositionsToCloud(stockPositions);
      await saveUSStockPositionsToCloud(usStockPositions);
      await saveCryptoPositionsToCloud(cryptoData.positions);
      await saveDebtsToCloud(debts);

      // 儲存快照與目標
      await saveSnapshotsToCloud(history.snapshots);
      await saveGoalsToCloud(history.goals);

      setCloudStatus('synced');
      console.log('✅ 雲端上傳完成');
    } catch (error) {
      console.error('❌ 雲端上傳失敗:', error);
      setCloudStatus('error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleCloudDownload = async () => {
    setIsCloudSyncing(true);
    setCloudStatus('idle');
    try {
      console.log('☁️ 開始從雲端下載...');
      const cloudData = await loadAllFromCloud();

      // 載入設定
      if (cloudData.settings) {
        setSettings(cloudData.settings);
      }

      // 載入 walletBalance
      if (cloudData.walletBalance > 0) {
        setCryptoData(prev => ({ ...prev, walletBalance: cloudData.walletBalance }));
      }

      // 載入持倉
      if (cloudData.stockPositions.length > 0) {
        setStockPositions(cloudData.stockPositions);
      }
      if (cloudData.usStockPositions.length > 0) {
        setUSStockPositions(cloudData.usStockPositions);
      }
      if (cloudData.cryptoPositions.length > 0) {
        setCryptoData(prev => ({ ...prev, positions: cloudData.cryptoPositions }));
      }
      if (cloudData.debts.length > 0) {
        setDebts(cloudData.debts);
      }

      // 載入快照與目標到本地歷史
      const currentHistory = getHistory();
      if (cloudData.snapshots.length > 0) {
        // 合併或覆蓋快照？這裡選擇覆蓋以保持一致
        currentHistory.snapshots = cloudData.snapshots;
      }
      if (cloudData.goals.length > 0) {
        currentHistory.goals = cloudData.goals;
      }
      saveHistory(currentHistory);

      // 觸發歷史頁面刷新
      setHistoryLastUpdated(Date.now());

      setCloudStatus('synced');
      console.log('✅ 雲端下載完成');
    } catch (error) {
      console.error('❌ 雲端下載失敗:', error);
      setCloudStatus('error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // --- TianJi Advice Trigger ---
  const askTianJi = useCallback(async () => {
    if (results.netWorth === 0) return;
    setIsLoading(true);
    setTianJiMessage("天機連線中... (老夫正在燃燒 GPU 占卦)");

    // 傳送完整數據給 AI
    const persona = customPersona.trim() || undefined;
    const question = userQuestion.trim() || undefined;

    const advice = await getTianJiAdvice(
      results,
      stockPositions,
      cryptoData.positions || [],
      persona,
      question
    );
    setTianJiMessage(advice);
    setIsLoading(false);
    setUserQuestion('');  // 清空問題
  }, [results, stockPositions, cryptoData.positions, customPersona, userQuestion]);

  // 刷新匯率
  const refreshRate = useCallback(async () => {
    setIsRefreshingRate(true);
    const rate = await getUsdtTwdRate();
    if (rate) {
      setSettings(prev => ({ ...prev, usdtTwdRate: rate.last }));
    }
    setIsRefreshingRate(false);
  }, []);

  // Auto-trigger advice logic
  useEffect(() => {
    if (results.realLeverage > 0) {
      const timer = setTimeout(() => {
        let msg = "";
        if (results.realLeverage > 2.5) msg = "🔥 總槓桿過高！閻王在跳舞！請去「寒玉床」冷靜！";
        else if (results.stockMaintenanceRate !== null && results.stockMaintenanceRate < 140) msg = "⚠️ 台股追繳令警告！請準備「補血湯」(現金)！";
        else if (results.totalStockPnL < 0 && results.totalCryptoPnL < 0) msg = "📉 股幣雙殺，閉關修練為上。";
        else if (results.stockLeverage > 2.6) msg = "⚠️ 台股融資水位過高，小心主力洗盤。";
        else if (results.cryptoLeverage > 5) msg = "⚠️ 幣圈賭性太強，施主小心爆倉。";
        else if (results.realLeverage < 1.0 && results.netWorth > 1000000) msg = "🧘‍♂️ 施主現金充裕（槓桿<1），穩如泰山。";
        else msg = "🧐 數據尚可。保持警惕，心無雜念。";

        setTianJiMessage(msg);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [results.realLeverage, results.stockMaintenanceRate, results.netWorth, results.stockLeverage, results.cryptoLeverage]);

  const utilizationResults = {
    stock: results.stockUtilization,
    usStock: results.usStockUtilization,
    crypto: results.cryptoUtilization
  };

  return (
    <div className="min-h-screen text-gray-200 font-sans selection:bg-cyan-500 selection:text-white pb-20">

      {/* Navbar - 玻璃擬態風格 */}
      <nav className="glass-card border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg logo-glow font-cyber">天</div>
            <div>
              <h1 className="text-xl font-bold text-gradient-cyan font-cyber">
                天機·火控雷達 v3.0
              </h1>
              <p className="text-xs text-gray-500">賽博養生村</p>
            </div>
          </div>

          {/* Tab 切換 - 膠囊按鈕 */}
          <div className="flex items-center gap-1 glass-card-dark rounded-full p-1">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-4 py-1.5 rounded-full text-sm transition-all btn-press ${currentTab === 'dashboard'
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              📊 儀表板
            </button>
            <button
              onClick={() => setCurrentTab('history')}
              className={`px-4 py-1.5 rounded-full text-sm transition-all btn-press ${currentTab === 'history'
                ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              📈 歷史
            </button>
            <button
              onClick={() => setCurrentTab('quant')}
              className={`px-4 py-1.5 rounded-full text-sm transition-all btn-press ${currentTab === 'quant'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              🔬 量化
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs md:text-sm">
            {/* 手動快照按鈕 */}
            <button
              onClick={createSnapshot}
              className="flex items-center gap-1 glass-card-dark px-3 py-1.5 rounded-full border border-gray-700/50 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:glow-emerald transition-all btn-press"
              title="手動快照"
            >
              <Camera size={14} /> 快照
            </button>

            {/* 全局刷新按鈕 */}
            <button
              onClick={handleGlobalRefresh}
              disabled={isGlobalRefreshing}
              className="flex items-center gap-1 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 text-white px-4 py-1.5 rounded-full transition-all shadow-lg hover:shadow-cyan-500/25 btn-press"
              title="刷新所有數據 + 快照"
            >
              <RefreshCw size={14} className={isGlobalRefreshing ? 'animate-spin' : ''} />
              {isGlobalRefreshing ? '刷新中...' : '刷新全部'}
            </button>

            {/* 雲端同步按鈕組 */}
            <div className="flex items-center gap-0 glass-card-dark rounded-full border border-gray-700/50">
              <button
                onClick={handleCloudUpload}
                disabled={isCloudSyncing}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-l-full transition-all ${cloudStatus === 'synced' ? 'text-emerald-400' : cloudStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                  } hover:text-white hover:bg-gray-700/50 disabled:opacity-50`}
                title="上傳到雲端"
              >
                <Cloud size={14} className={isCloudSyncing ? 'animate-pulse' : ''} />
                {isCloudSyncing ? '' : '↑'}
              </button>
              <div className="w-px h-4 bg-gray-600/50" />
              <button
                onClick={handleCloudDownload}
                disabled={isCloudSyncing}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-r-full text-gray-400 hover:text-white hover:bg-gray-700/50 disabled:opacity-50 transition-all"
                title="從雲端下載"
              >
                <CloudOff size={14} className={isCloudSyncing ? 'animate-pulse' : ''} />
                ↓
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Tab 內容切換 */}
        {currentTab === 'history' ? (
          <HistoryPage
            currentNetWorth={results.netWorth}
            breakdown={breakdown}
            utilization={utilizationResults}
            stockPositions={stockPositions}
            usStockPositions={usStockPositions}
            cryptoPositions={cryptoData.positions}
            debts={debts}
            cashUsd={settings.cashUsd}
            usdTwdRate={settings.usdTwdRate}
            lastUpdated={historyLastUpdated}
          />
        ) : currentTab === 'quant' ? (
          <QuantPage />
        ) : (
          <>
            {/* TianJi's Commentary Area */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-l-4 border-cyan-500 rounded-r-lg p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity size={100} />
              </div>
              <div className="relative z-10 flex gap-4">
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-cyan-500 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20">🧙‍♂️</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-cyan-400 font-bold flex items-center gap-2">
                      天機管家 (TianJi) - 財務軍師
                      {isLoading && <span className="animate-spin">⏳</span>}
                    </h2>
                    <button
                      onClick={() => setShowAISettings(!showAISettings)}
                      className="text-gray-400 hover:text-cyan-400 transition-colors"
                      title="AI 人設設定"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                  <div className="text-gray-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                    {tianJiMessage}
                  </div>

                  {/* 問題輸入區 */}
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={userQuestion}
                      onChange={e => setUserQuestion(e.target.value)}
                      onKeyDown={e => {
                        // Cmd+Enter (Mac) 或 Ctrl+Enter (Windows) 才送出
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          askTianJi();
                        }
                      }}
                      placeholder="問老夫一個問題... (⌘+Enter 送出)"
                      className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-500 outline-none"
                    />
                    <button
                      onClick={askTianJi}
                      disabled={isLoading}
                      className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <MessageSquare size={16} />
                      占卦
                    </button>
                  </div>

                  <div className="mt-2 text-[10px] text-gray-500">
                    *點擊「占卦」讓老夫根據你的財務數據給建議。可輸入具體問題。
                  </div>
                </div>
              </div>
            </div>

            {/* AI 設定彈窗 */}
            {showAISettings && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-cyan-400 font-bold flex items-center gap-2">
                    <Settings size={16} /> AI 命理設定
                  </h3>
                  <button onClick={() => setShowAISettings(false)} className="text-gray-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                {/* 八字計算區 */}
                <div className="bg-gray-800 rounded-lg p-3 space-y-3">
                  <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <Calendar size={14} /> 生辰八字計算
                  </h4>
                  <p className="text-xs text-gray-400">輸入西曆生辰，系統自動計算四柱八字</p>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">年</label>
                      <input
                        type="number"
                        value={birthYear}
                        onChange={e => setBirthYear(e.target.value)}
                        placeholder="1990"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">月</label>
                      <input
                        type="number"
                        value={birthMonth}
                        onChange={e => setBirthMonth(e.target.value)}
                        placeholder="5"
                        min="1" max="12"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">日</label>
                      <input
                        type="number"
                        value={birthDay}
                        onChange={e => setBirthDay(e.target.value)}
                        placeholder="15"
                        min="1" max="31"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">時 (0-23)</label>
                      <input
                        type="number"
                        value={birthHour}
                        onChange={e => setBirthHour(e.target.value)}
                        placeholder="14"
                        min="0" max="23"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const year = parseInt(birthYear);
                      const month = parseInt(birthMonth);
                      const day = parseInt(birthDay);
                      const hour = parseInt(birthHour) || 12;

                      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                        const info: BirthInfo = { year, month, day, hour };
                        setBirthInfo(info);
                        saveBirthInfo(info);
                        const result = calculateBaZi(info);
                        setBaziResult(result);

                        // 自動帶入人設
                        const baziPersona = result.formatted;
                        setCustomPersona(prev => {
                          const newPersona = baziPersona + (prev ? '\n\n' + prev.replace(result.formatted, '').trim() : '');
                          saveCustomPersona(newPersona);
                          return newPersona;
                        });
                      }
                    }}
                    className="w-full bg-purple-700 hover:bg-purple-600 text-white text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    ✨ 計算八字並帶入
                  </button>

                  {baziResult && (
                    <div className="bg-gray-700 rounded p-2 text-xs font-mono text-purple-300 whitespace-pre-wrap">
                      四柱：{baziResult.yearPillar.ganZhi} {baziResult.monthPillar.ganZhi} {baziResult.dayPillar.ganZhi} {baziResult.hourPillar.ganZhi}
                      <br />
                      日主：{baziResult.dayMasterYinYang} | 生肖：{baziResult.zodiac}
                      <br />
                      五行：木{baziResult.wuXingCount['木']} 火{baziResult.wuXingCount['火']} 土{baziResult.wuXingCount['土']} 金{baziResult.wuXingCount['金']} 水{baziResult.wuXingCount['水']}
                    </div>
                  )}
                </div>

                {/* 額外人設輸入區 */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">額外信息（可自由輸入，如用神、忌神、投資目標等）</p>
                  <textarea
                    value={customPersona}
                    onChange={e => {
                      setCustomPersona(e.target.value);
                      saveCustomPersona(e.target.value);
                    }}
                    placeholder="例如：\n喜用神：火、燥土\n忌神：金、水\n投資目標：5年內資產翻倍\n紫微流年：2026丙午年，貪狼化祿"
                    className="w-full h-32 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-cyan-500 outline-none resize-none custom-scrollbar"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">設定會自動儲存到本地</span>
                  <button
                    onClick={() => {
                      setCustomPersona('');
                      saveCustomPersona('');
                      setBaziResult(null);
                      setBirthYear('');
                      setBirthMonth('');
                      setBirthDay('');
                      setBirthHour('12');
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    清除所有設定
                  </button>
                </div>
              </div>
            )}

            {/* Top KPI Cards - Expanded Layout */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Net Worth */}
              <div className="col-span-2 lg:col-span-1 bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2"><BadgeDollarSign size={16} /> 總淨值 (Net Worth)</div>
                <div className="text-2xl font-bold text-white font-mono mt-1 truncate">
                  <span className="text-xs align-top text-gray-500 mr-1">TWD</span>
                  {Math.round(results.netWorth).toLocaleString()}
                </div>
              </div>

              {/* Real Leverage (Split 3 ways) */}
              <div className="col-span-2 lg:col-span-1 bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between relative overflow-hidden hover:border-gray-600 transition-colors group">
                <div className="text-gray-400 text-sm flex items-center gap-2"><ShieldAlert size={16} /> 真實槓桿 (總體)</div>
                <div className={`text-3xl font-bold font-mono mt-1 ${results.realLeverage > 2 ? 'text-red-500' : results.realLeverage > 1.5 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {results.realLeverage.toFixed(2)}x
                </div>

                {/* Hover details - 槓桿 + 運用率 */}
                <div className="absolute inset-0 bg-gray-900/95 flex flex-col justify-center px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="text-xs text-gray-500 mb-1">融資槓桿 / 資金運用率</div>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-cyan-400">🇹🇼 台股</span>
                    <span className="font-mono">
                      <span className={`${results.stockLeverage > 2.5 ? 'text-red-400' : 'text-white'}`}>{results.stockLeverage > 100 ? '>100' : results.stockLeverage.toFixed(2)}x</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="text-yellow-300">{(results.stockUtilization * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-green-400">🇺🇸 美股</span>
                    <span className="font-mono">
                      <span className={`${results.usStockLeverage > 2 ? 'text-red-400' : 'text-white'}`}>{results.usStockLeverage > 100 ? '>100' : results.usStockLeverage.toFixed(2)}x</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="text-yellow-300">{(results.usStockUtilization * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-purple-400">₿ 幣圈</span>
                    <span className="font-mono">
                      <span className={`${results.cryptoLeverage > 5 ? 'text-red-400' : 'text-white'}`}>{results.cryptoLeverage > 100 ? '>100' : results.cryptoLeverage.toFixed(2)}x</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="text-yellow-300">{(results.cryptoUtilization * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                </div>
                <div className="absolute top-2 right-2 text-gray-600 group-hover:hidden"><Info size={12} /></div>
              </div>

              {/* Stock Profit */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2"><TrendingUp size={16} /> 台股獲利 (TWD)</div>
                <div className={`text-xl font-bold font-mono mt-1 ${results.totalStockPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {results.totalStockPnL > 0 ? '+' : ''}{(results.totalStockPnL / 10000).toFixed(2)}萬
                  <div className="text-xs opacity-70">({results.totalStockPnLPercent.toFixed(1)}%)</div>
                </div>
              </div>

              {/* US Stock Profit - 顯示 TWD 等值 */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2"><DollarSign size={16} /> 美股獲利 (USD)</div>
                <div className={`text-xl font-bold font-mono mt-1 ${results.totalUSStockPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {results.totalUSStockPnL > 0 ? '+' : ''}${results.totalUSStockPnL.toFixed(0)}
                  <div className="text-xs opacity-70">({results.totalUSStockPnLPercent.toFixed(1)}%)</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ≈ TWD {results.totalUSStockPnL >= 0 ? '+' : ''}{((results.totalUSStockPnL * (settings.usdTwdRate || 31.5)) / 10000).toFixed(2)}萬
                </div>
              </div>

              {/* Crypto Profit - 以 USDT 為主，顯示 TWD 等值 */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-600 transition-colors relative">
                <div className="text-gray-400 text-sm flex items-center gap-2"><Bitcoin size={16} /> 幣圈獲利 (USDT)</div>
                <div className={`text-xl font-bold font-mono mt-1 ${results.totalCryptoPnL >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                  {results.totalCryptoPnL > 0 ? '+' : ''}₮{(results.totalCryptoPnL / settings.usdtTwdRate).toFixed(0)}
                  <div className="text-xs opacity-70">({results.totalCryptoPnLPercent.toFixed(1)}%)</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ≈ TWD {results.totalCryptoPnL >= 0 ? '+' : ''}{(results.totalCryptoPnL / 10000).toFixed(2)}萬
                </div>
              </div>

              {/* 總獲利 (新增) */}
              {(() => {
                const totalPnlTwd = results.totalStockPnL + (results.totalUSStockPnL * (settings.usdTwdRate || 31.5)) + results.totalCryptoPnL;
                const totalPnlPct = (results.totalStockPnLPercent + results.totalUSStockPnLPercent + results.totalCryptoPnLPercent) / 3;
                return (
                  <div className="bg-gradient-to-br from-gray-900 to-emerald-900/30 p-4 rounded-xl border border-emerald-800/50 flex flex-col justify-between hover:border-emerald-600 transition-colors">
                    <div className="text-gray-400 text-sm flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" /> 總獲利 (All)</div>
                    <div className={`text-2xl font-bold font-mono mt-1 ${totalPnlTwd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {totalPnlTwd >= 0 ? '+' : ''}{(totalPnlTwd / 10000).toFixed(1)}萬
                    </div>
                    <div className="text-xs text-gray-500">台+美+幣 合計</div>
                  </div>
                );
              })()}

              {/* Total Debt */}
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2"><CreditCard size={16} /> 總負債 (Debt)</div>
                <div className={`text-xl font-bold font-mono mt-1 ${results.totalDebt > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {results.totalDebt > 0 ? '-' : ''}{(results.totalDebt / 10000).toFixed(1)}萬
                  <div className="text-xs opacity-70 text-gray-500">TWD</div>
                </div>
              </div>
            </div>

            {/* Calculation Breakdown */}
            <CalculationBreakdown data={breakdown} />

            {/* Cash & Rate Input - 4 columns */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-4 hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2 whitespace-nowrap"><Settings size={16} /> 台幣現金</div>
                <input
                  type="number"
                  value={settings.cashTwd}
                  onChange={e => setSettings({ ...settings, cashTwd: Number(e.target.value) })}
                  className="bg-gray-800 rounded px-3 py-1 text-lg font-bold text-white font-mono outline-none focus:ring-1 ring-cyan-500 w-full"
                />
              </div>
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-4 hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2 whitespace-nowrap"><DollarSign size={16} /> 美金現金</div>
                <input
                  type="number"
                  value={settings.cashUsd || 0}
                  onChange={e => setSettings({ ...settings, cashUsd: Number(e.target.value) })}
                  className="bg-gray-800 rounded px-3 py-1 text-lg font-bold text-green-400 font-mono outline-none focus:ring-1 ring-green-500 w-full"
                />
              </div>
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-2 hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2 whitespace-nowrap"><DollarSign size={16} /> USD 匯率</div>
                <input
                  type="number"
                  value={settings.usdTwdRate || 31.5}
                  onChange={e => setSettings({ ...settings, usdTwdRate: Number(e.target.value) })}
                  step="0.1"
                  className="bg-gray-800 rounded px-3 py-1 text-lg font-bold text-white font-mono outline-none focus:ring-1 ring-green-500 w-full"
                />
                <button
                  onClick={async () => {
                    const rate = await getUsdTwdRate();
                    if (rate) {
                      setSettings({ ...settings, usdTwdRate: rate });
                      console.log(`✅ USD/TWD 匯率已更新: ${rate}`);
                    }
                  }}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                  title="從 API 取得即時匯率"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-4 hover:border-gray-600 transition-colors">
                <div className="text-gray-400 text-sm flex items-center gap-2 whitespace-nowrap"><Bitcoin size={16} /> USDT 匯率</div>
                <input
                  type="number"
                  value={settings.usdtTwdRate}
                  onChange={e => setSettings({ ...settings, usdtTwdRate: Number(e.target.value) })}
                  step="0.1"
                  className="bg-gray-800 rounded px-3 py-1 text-lg font-bold text-white font-mono outline-none focus:ring-1 ring-orange-500 w-full"
                />
              </div>
            </div>

            {/* 原始本金 & 真實獲利 */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-5 rounded-xl border border-gray-700">
              <div className="text-gray-300 text-sm mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                原始本金 & 真實總獲利
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* 原始本金輸入 */}
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">原始台幣本金</div>
                  <input
                    type="number"
                    value={settings.originalCapitalTwd || 0}
                    onChange={e => setSettings({ ...settings, originalCapitalTwd: Number(e.target.value) })}
                    className="bg-gray-700 rounded px-2 py-1 text-white font-mono w-full outline-none focus:ring-1 ring-cyan-500"
                  />
                </div>

                {/* 原始美金本金 - 支援 TWD 換算 */}
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1 flex justify-between">
                    <span>原始美金本金</span>
                    <span className="text-green-400">$USD</span>
                  </div>
                  <input
                    type="number"
                    value={settings.originalCapitalUsd || 0}
                    onChange={e => setSettings({ ...settings, originalCapitalUsd: Number(e.target.value) })}
                    className="bg-gray-700 rounded px-2 py-1 text-green-400 font-mono w-full outline-none focus:ring-1 ring-green-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    ≈ TWD {((settings.originalCapitalUsd || 0) * (settings.usdTwdRate || 31.5)).toLocaleString()}
                  </div>
                </div>

                {/* 原始 USDT 本金 - 支援 TWD 換算 */}
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1 flex justify-between">
                    <span>原始 USDT 本金</span>
                    <span className="text-orange-400">₮USDT</span>
                  </div>
                  <input
                    type="number"
                    value={settings.originalCapitalUsdt || 0}
                    onChange={e => setSettings({ ...settings, originalCapitalUsdt: Number(e.target.value) })}
                    className="bg-gray-700 rounded px-2 py-1 text-orange-400 font-mono w-full outline-none focus:ring-1 ring-orange-500"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    ≈ TWD {((settings.originalCapitalUsdt || 0) * settings.usdtTwdRate).toLocaleString()}
                  </div>
                </div>

                {/* 真實獲利計算 */}
                {(() => {
                  const originalTotalTwd =
                    (settings.originalCapitalTwd || 0) +
                    (settings.originalCapitalUsd || 0) * (settings.usdTwdRate || 31.5) +
                    (settings.originalCapitalUsdt || 0) * settings.usdtTwdRate;
                  const totalProfit = results.netWorth - originalTotalTwd;
                  const profitPercent = originalTotalTwd > 0 ? (totalProfit / originalTotalTwd) * 100 : 0;

                  return (
                    <div className="bg-gray-800/50 p-3 rounded-lg border border-emerald-900/50">
                      <div className="text-xs text-gray-500 mb-1">真實總獲利 (TWD)</div>
                      <div className={`text-xl font-bold font-mono ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalProfit >= 0 ? '+' : ''}{(totalProfit / 10000).toFixed(1)}萬
                      </div>
                      <div className={`text-xs font-mono ${totalProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="text-xs text-gray-500 flex items-center justify-between">
                <span>計算公式：真實獲利 = 目前淨值 - (台幣 + 美金×{settings.usdTwdRate || 31.5} + U×{settings.usdtTwdRate})</span>
                <span className="text-cyan-400">
                  原始本金合計: TWD {(
                    (settings.originalCapitalTwd || 0) +
                    (settings.originalCapitalUsd || 0) * (settings.usdTwdRate || 31.5) +
                    (settings.originalCapitalUsdt || 0) * settings.usdtTwdRate
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Main Input Sections - Draggable Dashboard */}
            <DraggableDashboard
              items={[
                {
                  id: 'allocation',
                  label: '資產配置',
                  component: (
                    <AllocationChart
                      cashTwd={settings.cashTwd}
                      cashUsd={settings.cashUsd || 0}
                      cashUsdt={cryptoData.walletBalance}
                      usdTwdRate={settings.usdTwdRate || 31.5}
                      usdtTwdRate={settings.usdtTwdRate}
                      stockPositions={stockPositions}
                      usStockPositions={usStockPositions}
                      cryptoPositions={cryptoData.positions || []}
                    />
                  ),
                },
                {
                  id: 'stock',
                  label: '台股部位',
                  component: <StockSection positions={stockPositions} setPositions={setStockPositions} />,
                },
                {
                  id: 'usstock',
                  label: '美股部位',
                  component: <USStockSection positions={usStockPositions} setPositions={setUSStockPositions} usdTwdRate={settings.usdTwdRate || 31.5} />,
                },
                {
                  id: 'crypto',
                  label: '加密貨幣',
                  component: <CryptoSection data={cryptoData} setData={setCryptoData} usdtRate={settings.usdtTwdRate} />,
                },
                {
                  id: 'debt',
                  label: '負債資產',
                  component: <DebtSection debts={debts} setDebts={setDebts} />,
                },
              ]}
            />

          </>
        )}
      </main>

      {/* 贊助資訊 Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8 mb-8 border-t border-gray-800 text-center space-y-4">
        <p className="text-gray-400 text-sm">
          如果您喜歡此作品，可以考慮透過以下方式支持持續開發：
        </p>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-xs font-mono text-gray-500">
          <div
            className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800 flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition-colors group active:scale-95 transform"
            onClick={() => {
              navigator.clipboard.writeText('TExxw25EaPKZdKr9uPJT8MLV2zHrQBbhQg');
              alert('已複製 USDT 地址！'); // 簡單反饋，或者可以用 toast
            }}
            title="點擊複製 USDT 地址"
          >
            <span className="text-green-500 font-bold">USDT (TRC20)</span>
            <span className="group-hover:text-white transition-colors">TExxw25EaPKZdKr9uPJT8MLV2zHrQBbhQg</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 text-[10px] ml-1">📋</span>
          </div>
          <div
            className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800 flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition-colors group active:scale-95 transform"
            onClick={() => {
              navigator.clipboard.writeText('liupony2000.x');
              alert('已複製 X Payments 地址！');
            }}
            title="點擊複製 X Payments 地址 (多幣錢包)"
          >
            <div className="flex flex-col items-start">
              <span className="text-blue-400 font-bold flex items-center gap-1">
                X Payments
                <span className="text-[10px] text-gray-500 font-normal border border-gray-700 rounded px-1 ml-1">多幣錢包地址</span>
              </span>
              <span className="group-hover:text-white transition-colors flex items-center gap-1">
                liupony2000.x
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 text-[10px]">📋</span>
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          TianJi-FCR v3.0 &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

export default App;