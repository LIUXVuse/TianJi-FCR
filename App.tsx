import React, { useState, useEffect, useCallback } from 'react';
import { StockSection } from './components/StockSection';
import { CryptoSection } from './components/CryptoSection';
import { USStockSection } from './components/USStockSection';
import { DebtSection } from './components/DebtSection';
import { CalculationBreakdown } from './components/CalculationBreakdown';
import { StockPosition, CryptoState, GlobalSettings, AnalysisResult, USStockPosition, DebtItem } from './types';
import { Settings, ShieldAlert, BadgeDollarSign, Activity, TrendingUp, Bitcoin, Info, RefreshCw, MessageSquare, X, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { getTianJiAdvice, DEFAULT_PERSONA, getCustomPersona, saveCustomPersona } from './services/deepseekService';
import { getUsdtTwdRate } from './services/maxService';
import { calculateBaZi, getBirthInfo, saveBirthInfo, BirthInfo, BaZiResult } from './services/baziService';

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
    savedData.settings || { usdtTwdRate: 31.3, usdTwdRate: 31.5, cashTwd: 100000 }
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
    stockLeverage: 0,
    usStockLeverage: 1,
    cryptoLeverage: 0,
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
    stockEquityTwd: 0,
    usStockEquityTwd: 0,
    cryptoEquityTwd: 0,
    grossAssetsTwd: 0,
    stockLoanTwd: 0,
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
    // 1. Taiwan Stock Math
    const stockMarketValue = stockPositions.reduce((acc, p) => acc + (p.price * p.shares), 0);
    const stockCostValue = stockPositions.reduce((acc, p) => acc + (p.costPrice * p.shares), 0);
    const stockLoan = stockPositions.reduce((acc, p) => acc + p.loanAmount, 0);
    const stockNetEquity = stockMarketValue - stockLoan;
    const stockLeverage = stockNetEquity > 0 ? stockMarketValue / stockNetEquity : (stockMarketValue > 0 ? 999 : 0);
    const maintenanceRate = stockLoan > 0 ? (stockMarketValue / stockLoan) * 100 : null;
    const stockPnL = stockMarketValue - stockCostValue;
    const stockPnLPercent = stockCostValue > 0 ? (stockPnL / stockCostValue) * 100 : 0;

    // 2. US Stock Math
    const usdRate = settings.usdTwdRate || 31.5;
    const usStockMarketValue_USD = usStockPositions.reduce((acc, p) => acc + p.marketValue, 0);
    const usStockCostValue_USD = usStockPositions.reduce((acc, p) => acc + (p.costPrice * p.shares), 0);
    const usStockPnL_USD = usStockPositions.reduce((acc, p) => acc + p.pnl, 0);
    const usStockPnLPercent = usStockCostValue_USD > 0 ? (usStockPnL_USD / usStockCostValue_USD) * 100 : 0;
    const usStockEquityTwd = usStockMarketValue_USD * usdRate;
    const usStockExposureTwd = usStockMarketValue_USD * usdRate;

    // 3. Crypto Math
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
    const cryptoLeverage = cryptoNetEquity_USDT > 0 ? cryptoTotalPositionSize_USDT / cryptoNetEquity_USDT : (cryptoTotalPositionSize_USDT > 0 ? 999 : 0);
    const cryptoPnL_TWD = cryptoTotalPnL_USDT * settings.usdtTwdRate;
    const cryptoPnLPercent = cryptoCostBasis_USDT > 0 ? (cryptoTotalPnL_USDT / cryptoCostBasis_USDT) * 100 : 0;

    // 4. Debt Math
    const totalDebtAmount = debts.reduce((acc, d) => acc + d.outstandingAmount, 0);

    // 5. Total Portfolio Math
    const grossAssets = settings.cashTwd + stockNetEquity + usStockEquityTwd + cryptoNetEquityTwd;
    const totalLiabilities = stockLoan + totalDebtAmount;
    const totalNetWorth = grossAssets - totalDebtAmount;  // 負債扣除
    const totalExposure = stockMarketValue + usStockExposureTwd + cryptoExposureTwd;
    const realLeverage = totalNetWorth > 0 ? totalExposure / totalNetWorth : 0;

    // 更新結果
    setResults({
      netWorth: totalNetWorth,
      grossAssets: grossAssets,
      totalDebt: totalDebtAmount,
      totalExposure: totalExposure,
      realLeverage: realLeverage,
      stockLeverage: stockLeverage,
      usStockLeverage: 1,  // 美股一般不開槓桿
      cryptoLeverage: cryptoLeverage,
      stockMaintenanceRate: maintenanceRate,
      totalStockPnL: stockPnL,
      totalStockPnLPercent: stockPnLPercent,
      totalUSStockPnL: usStockPnL_USD,
      totalUSStockPnLPercent: usStockPnLPercent,
      totalCryptoPnL: cryptoPnL_TWD,
      totalCryptoPnLPercent: cryptoPnLPercent
    });

    // 更新計算明細
    setBreakdown({
      cashTwd: settings.cashTwd,
      stockEquityTwd: stockNetEquity,
      usStockEquityTwd: usStockEquityTwd,
      cryptoEquityTwd: cryptoNetEquityTwd,
      grossAssetsTwd: grossAssets,
      stockLoanTwd: stockLoan,
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


  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-cyan-500 selection:text-white pb-20">

      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-80 shadow-lg shadow-cyan-900/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow shadow-cyan-500/50">天</div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-emerald-400">
              天機·火控雷達 v2.5
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs md:text-sm">
            <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
              <span className="text-gray-400">USDT 匯率</span>
              <input
                type="number"
                value={settings.usdtTwdRate}
                onChange={e => setSettings({ ...settings, usdtTwdRate: Number(e.target.value) })}
                className="w-16 bg-transparent text-right font-mono text-cyan-400 outline-none focus:text-white"
              />
              <button
                onClick={refreshRate}
                disabled={isRefreshingRate}
                className="text-cyan-400 hover:text-cyan-300 disabled:text-gray-600"
                title="從 MAX 交易所取得即時匯率"
              >
                <RefreshCw size={14} className={isRefreshingRate ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

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

            {/* Hover details for specific leverages */}
            <div className="absolute inset-0 bg-gray-900/95 flex flex-col justify-center px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-gray-400">台股槓桿:</span>
                <span className={`font-mono ${results.stockLeverage > 2.5 ? 'text-red-400' : 'text-cyan-300'}`}>{results.stockLeverage > 100 ? '>100' : results.stockLeverage.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">幣圈槓桿:</span>
                <span className={`font-mono ${results.cryptoLeverage > 5 ? 'text-red-400' : 'text-purple-300'}`}>{results.cryptoLeverage > 100 ? '>100' : results.cryptoLeverage.toFixed(2)}x</span>
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

          {/* US Stock Profit */}
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-600 transition-colors">
            <div className="text-gray-400 text-sm flex items-center gap-2"><DollarSign size={16} /> 美股獲利 (USD)</div>
            <div className={`text-xl font-bold font-mono mt-1 ${results.totalUSStockPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {results.totalUSStockPnL > 0 ? '+' : ''}${results.totalUSStockPnL.toFixed(0)}
              <div className="text-xs opacity-70">({results.totalUSStockPnLPercent.toFixed(1)}%)</div>
            </div>
          </div>

          {/* Crypto Profit */}
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col justify-between hover:border-gray-600 transition-colors relative">
            <div className="text-gray-400 text-sm flex items-center gap-2"><Bitcoin size={16} /> 幣圈獲利 (TWD)</div>
            <div className={`text-xl font-bold font-mono mt-1 ${results.totalCryptoPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {results.totalCryptoPnL > 0 ? '+' : ''}{(results.totalCryptoPnL / 10000).toFixed(2)}萬
              <div className="text-xs opacity-70">({results.totalCryptoPnLPercent.toFixed(1)}%)</div>
            </div>
          </div>

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

        {/* Cash & USD Rate Input */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            <div className="text-gray-400 text-sm flex items-center gap-2 whitespace-nowrap"><DollarSign size={16} /> USD 匯率</div>
            <input
              type="number"
              value={settings.usdTwdRate || 31.5}
              onChange={e => setSettings({ ...settings, usdTwdRate: Number(e.target.value) })}
              step="0.1"
              className="bg-gray-800 rounded px-3 py-1 text-lg font-bold text-white font-mono outline-none focus:ring-1 ring-green-500 w-full"
            />
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

        {/* Main Input Sections - 4 columns on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StockSection positions={stockPositions} setPositions={setStockPositions} />
          <USStockSection positions={usStockPositions} setPositions={setUSStockPositions} usdTwdRate={settings.usdTwdRate || 31.5} />
          <CryptoSection data={cryptoData} setData={setCryptoData} usdtRate={settings.usdtTwdRate} />
          <DebtSection debts={debts} setDebts={setDebts} />
        </div>

      </main>
    </div>
  );
}

export default App;