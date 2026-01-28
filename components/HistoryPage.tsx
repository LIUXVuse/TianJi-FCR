/**
 * 歷史紀錄頁面 - 淨值走勢、資產配置、目標追蹤、波段分析、資產膨脹預測
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, ReferenceArea, PieChart, Pie, Cell, Legend, Brush
} from 'recharts';
import { TrendingUp, Target, BarChart3, Plus, Trash2, Award, ArrowUp, ArrowDown, Eye, EyeOff, PieChartIcon, Calculator, Clock } from 'lucide-react';
import { DailySnapshot, Goal } from '../types';
import {
    getSnapshots,
    getGoals,
    addGoal,
    deleteGoal,
    getWaveAnalysis,
    checkGoalProgress
} from '../services/historyService';

interface HistoryPageProps {
    currentNetWorth: number;
    breakdown?: {
        cashTwd: number;
        cashUsdTwd: number;
        stockEquityTwd: number;
        usStockEquityTwd: number;
        cryptoEquityTwd: number;
        totalDebtTwd: number;
        grossAssetsTwd: number;
    };
    // 運用率
    utilization?: {
        stock: number;
        usStock: number;
        crypto: number;
    };
    // 詳細持倉
    stockPositions?: Array<{ name: string; price: number; shares: number; costPrice: number; isMargin?: boolean }>;
    usStockPositions?: Array<{ symbol: string; price: number; shares: number; costPrice: number; marketValue?: number }>;
    cryptoPositions?: Array<{
        symbol: string;
        type: string;
        margin: number;      // 合約本金
        units: number;       // 現貨顆數
        leverage: number;
        currentPrice: number;
        entryPrice: number;
        positionSize: number; // 倉位價值
        pnl: number;          // 損益
        pnlPercent: number;   // 損益率
    }>;
    debts?: Array<{ name: string; amount: number }>;
    cashUsd?: number;
    usdTwdRate?: number;
    lastUpdated?: number; // 用於觸發資料重載
}

// 餅圖顏色
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const HistoryPage: React.FC<HistoryPageProps> = ({
    currentNetWorth,
    breakdown,
    utilization,
    stockPositions,
    usStockPositions,
    cryptoPositions,
    debts,
    cashUsd,
    usdTwdRate = 31.5,
    lastUpdated
}) => {
    const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [waveAnalysis, setWaveAnalysis] = useState<ReturnType<typeof getWaveAnalysis>>(null);
    const [newGoalName, setNewGoalName] = useState('');
    const [newGoalAmount, setNewGoalAmount] = useState('');

    // 目標參考線開關 - 從 localStorage 讀取
    const [showGoalLines, setShowGoalLines] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('tianji_goalLines');
            console.log('📂 讀取目標線設定:', saved);
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    // 是否已完成首次載入
    const [isLoadedGoalLines, setIsLoadedGoalLines] = useState(false);

    // 資產配置展開狀態
    const [expandedSection, setExpandedSection] = useState<'twd' | 'usd' | 'usdt' | 'total' | null>(null);

    // 時間區間 - 從 localStorage 讀取
    const [timeRange, setTimeRange] = useState<'7d' | '1m' | '3m' | '1y' | 'all' | 'custom'>(() => {
        try {
            const saved = localStorage.getItem('tianji_timeRange');
            return (saved as any) || 'all';
        } catch { return 'all'; }
    });

    // 自訂時間範圍
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // 資產膨脹預測區間選擇器
    const [growthRangeValue, setGrowthRangeValue] = useState<number>(0); // 0 = 全部
    const [growthRangeUnit, setGrowthRangeUnit] = useState<'day' | 'month' | 'year'>('day');

    // 預測曲線顯示開關
    const [showPredictionLine, setShowPredictionLine] = useState(true);

    // 標記已載入
    useEffect(() => {
        setIsLoadedGoalLines(true);
    }, []);

    // 儲存目標線開關狀態到 localStorage（僅在使用者變更後）
    useEffect(() => {
        if (isLoadedGoalLines) {
            console.log('💾 儲存目標線設定:', JSON.stringify(showGoalLines));
            localStorage.setItem('tianji_goalLines', JSON.stringify(showGoalLines));
        }
    }, [showGoalLines, isLoadedGoalLines]);

    // 儲存時間區間到 localStorage
    useEffect(() => {
        localStorage.setItem('tianji_timeRange', timeRange);
    }, [timeRange]);

    // 載入資料 (初始化或外部更新時)
    useEffect(() => {
        setSnapshots(getSnapshots());
        setGoals(getGoals());
        setWaveAnalysis(getWaveAnalysis());
    }, [lastUpdated]); // 監聽 lastUpdated 變化

    // 智慧初始化目標線開關 - 只開啟「下一個未達成的目標」
    useEffect(() => {
        if (goals.length === 0) return;

        // 依金額排序目標
        const sortedGoals = [...goals].sort((a, b) => a.targetAmount - b.targetAmount);

        // 找出下一個未達成的目標
        const nextGoal = sortedGoals.find(g => g.targetAmount > currentNetWorth);

        const initial: Record<string, boolean> = {};
        goals.forEach(g => {
            // 只開啟下一個未達成的目標，或如果全部都達成了就開最高的
            if (nextGoal) {
                initial[g.id] = g.id === nextGoal.id;
            } else {
                // 全部達成，開啟最高的那個
                initial[g.id] = g.id === sortedGoals[sortedGoals.length - 1].id;
            }
        });
        setShowGoalLines(initial);
    }, [goals, currentNetWorth]);

    // 根據時間區間過濾快照
    const filteredSnapshots = useMemo(() => {
        if (timeRange === 'all') return snapshots;

        const now = new Date();
        const cutoff = new Date();
        let startTime = 0;
        let endTime = Infinity;

        if (timeRange === 'custom') {
            if (customStart) startTime = new Date(customStart).getTime();
            if (customEnd) {
                const end = new Date(customEnd);
                end.setHours(23, 59, 59, 999); // 包含當天結束
                endTime = end.getTime();
            }
        } else {
            switch (timeRange) {
                case '7d': cutoff.setDate(now.getDate() - 7); break;
                case '1m': cutoff.setMonth(now.getMonth() - 1); break;
                case '3m': cutoff.setMonth(now.getMonth() - 3); break;
                case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
            }
            startTime = cutoff.getTime();
        }

        return snapshots.filter(s => {
            // 優先使用 timestamp，若無則回退到 id 解析 (兼容舊資料)
            // 注意：s.id 格式為 YYYY-MM-DD-HH:mm:ss，需轉為標準格式 YYYY-MM-DDTHH:mm:ss
            let time = s.timestamp;
            if (!time) {
                const standardizedId = s.id.replace(/-/g, '/').replace(/(\d{4}\/\d{2}\/\d{2})_(\d{2}:\d{2}:\d{2})/, '$1 $2');
                // 嘗試多種解析，或直接用字串處理。最簡單是假設格式固定。
                // 這裡簡單處理：如果是舊資料且無 timestamp，可能會有時區問題，建議依賴 timestamp
                // 如果是本專案生成的新資料，一定有 timestamp
                // 若只有 id:
                try {
                    // id format: 2024-12-14-15:43:09
                    // split it
                    const parts = s.id.split('-');
                    if (parts.length >= 3) {
                        const dateStr = parts.slice(0, 3).join('-') + 'T' + parts.slice(3).join(':');
                        time = new Date(dateStr).getTime();
                    }
                } catch (e) { console.error('Date parse error', e); }
            }
            if (!time) return true; // 保留無法解析的以防萬一

            return time >= startTime && time <= endTime;
        });
    }, [snapshots, timeRange, customStart, customEnd]);

    // 格式化圖表資料
    const chartData = useMemo(() => {
        const baseData = filteredSnapshots.map(s => ({
            date: s.id.slice(5), // MM-DD
            netWorth: Math.round(s.netWorth / 10000), // 萬
            fullDate: s.id,
            prediction: null as number | null
        }));

        // 如果要顯示預測曲線且有足夠資料
        if (showPredictionLine && baseData.length >= 2) {
            // 直接計算成長率（從資料本身，不依賴 growthAnalysis）
            const first = filteredSnapshots[0];
            const last = filteredSnapshots[filteredSnapshots.length - 1];

            const firstTime = first.timestamp || Date.now();
            const lastTime = last.timestamp || Date.now();
            const days = Math.max(1, Math.ceil((lastTime - firstTime) / (1000 * 60 * 60 * 24)));

            const changePercent = ((last.netWorth - first.netWorth) / first.netWorth) * 100;
            const dailyRate = changePercent / days / 100;

            const lastActualValue = baseData[baseData.length - 1].netWorth;

            // 計算要預測的天數（基於資料範圍的 50%）
            const predictionDays = Math.max(7, Math.floor(baseData.length * 0.5));

            // 為最後一個實際資料點加上預測值（作為連接點）
            baseData[baseData.length - 1].prediction = lastActualValue;

            // 生成預測資料點
            for (let i = 1; i <= predictionDays; i++) {
                const predictedValue = lastActualValue * Math.pow(1 + dailyRate, i);
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + i);
                const dateStr = `${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

                baseData.push({
                    date: dateStr,
                    netWorth: null as any, // 實際資料為 null
                    fullDate: `預測-${i}`,
                    prediction: Math.round(predictedValue)
                });
            }
        }

        return baseData;
    }, [filteredSnapshots, showPredictionLine]);

    // 輔助函式：解析快照 ID 為 timestamp
    // ID 格式: YYYY-MM-DD-HH:mm:ss 或純日期 YYYY-MM-DD
    const parseSnapshotTime = (snapshot: DailySnapshot): number => {
        // 優先使用 timestamp 欄位
        if (snapshot.timestamp) return snapshot.timestamp;

        const id = snapshot.id;
        try {
            // 格式: YYYY-MM-DD-HH:mm:ss
            const parts = id.split('-');
            if (parts.length >= 3) {
                const datePart = parts.slice(0, 3).join('-'); // YYYY-MM-DD
                const timePart = parts.length > 3 ? parts.slice(3).join(':') : '00:00:00'; // HH:mm:ss
                return new Date(`${datePart}T${timePart}`).getTime();
            }
        } catch (e) {
            console.error('Date parse error for snapshot:', id, e);
        }
        return Date.now(); // fallback
    };

    // 資產膨脹預測專用快照過濾
    const growthFilteredSnapshots = useMemo(() => {
        if (snapshots.length === 0) return [];

        // 如果 growthRangeValue 為 0，使用全部快照
        if (growthRangeValue === 0) return snapshots;

        const now = Date.now();
        let cutoffMs = 0;

        switch (growthRangeUnit) {
            case 'day':
                cutoffMs = growthRangeValue * 24 * 60 * 60 * 1000;
                break;
            case 'month':
                cutoffMs = growthRangeValue * 30 * 24 * 60 * 60 * 1000;
                break;
            case 'year':
                cutoffMs = growthRangeValue * 365 * 24 * 60 * 60 * 1000;
                break;
        }

        const cutoffTime = now - cutoffMs;

        return snapshots.filter(s => {
            const time = parseSnapshotTime(s);
            return time >= cutoffTime;
        });
    }, [snapshots, growthRangeValue, growthRangeUnit]);

    // 資產膨脹預測
    const growthAnalysis = useMemo(() => {
        if (growthFilteredSnapshots.length < 2) return null;

        const first = growthFilteredSnapshots[0];
        const last = growthFilteredSnapshots[growthFilteredSnapshots.length - 1];

        const firstTime = parseSnapshotTime(first);
        const lastTime = parseSnapshotTime(last);
        const days = Math.max(1, Math.ceil((lastTime - firstTime) / (1000 * 60 * 60 * 24)));

        const change = last.netWorth - first.netWorth;
        const changePercent = (change / first.netWorth) * 100;
        const dailyGrowthRate = changePercent / days;
        const monthlyGrowthRate = dailyGrowthRate * 30;
        const annualizedRate = dailyGrowthRate * 365;

        // 預估達成各目標天數
        const goalProjections = goals.map(goal => {
            if (currentNetWorth >= goal.targetAmount) {
                return { goal, daysToGoal: 0, achieved: true };
            }

            if (dailyGrowthRate <= 0) {
                return { goal, daysToGoal: Infinity, achieved: false };
            }

            const daysNeeded = Math.log(goal.targetAmount / currentNetWorth) / Math.log(1 + dailyGrowthRate / 100);
            return { goal, daysToGoal: Math.ceil(daysNeeded), achieved: false };
        });

        return {
            days,
            change,
            changePercent,
            dailyGrowthRate,
            monthlyGrowthRate,
            annualizedRate,
            goalProjections,
            // 公式驗證用資料
            firstNetWorth: first.netWorth,
            lastNetWorth: last.netWorth,
            firstDate: first.id.slice(0, 10),
            lastDate: last.id.slice(0, 10),
            // 區間設定 (供 UI 同步用)
            snapshotCount: growthFilteredSnapshots.length
        };
    }, [growthFilteredSnapshots, goals, currentNetWorth]);

    // 資產配置餅圖資料
    const pieData = useMemo(() => {
        if (!breakdown) return { twd: [], usd: [], usdt: [], total: [] };

        return {
            twd: [
                { name: '台幣現金', value: breakdown.cashTwd, color: '#10b981' },
                { name: '台股市值', value: breakdown.stockEquityTwd, color: '#3b82f6' }
            ].filter(d => d.value > 0),

            usd: [
                { name: '美金現金', value: breakdown.cashUsdTwd, color: '#f59e0b' },
                { name: '美股市值', value: breakdown.usStockEquityTwd, color: '#8b5cf6' }
            ].filter(d => d.value > 0),

            usdt: [
                { name: '幣圈市值', value: breakdown.cryptoEquityTwd, color: '#ec4899' }
            ].filter(d => d.value > 0),

            total: [
                { name: '淨資產', value: breakdown.grossAssetsTwd - breakdown.totalDebtTwd, color: '#10b981' },
                { name: '總負債', value: breakdown.totalDebtTwd, color: '#ef4444' }
            ].filter(d => d.value > 0)
        };
    }, [breakdown]);

    // 新增目標
    const handleAddGoal = () => {
        if (!newGoalName || !newGoalAmount) return;

        const goal: Goal = {
            id: Date.now().toString(),
            name: newGoalName,
            targetAmount: Number(newGoalAmount) * 10000,
            createdAt: new Date().toISOString()
        };

        addGoal(goal);
        setGoals(getGoals());
        setShowGoalLines(prev => ({ ...prev, [goal.id]: true }));
        setNewGoalName('');
        setNewGoalAmount('');
    };

    // 刪除目標
    const handleDeleteGoal = (id: string) => {
        deleteGoal(id);
        setGoals(getGoals());
    };

    // 切換目標線
    const toggleGoalLine = (id: string) => {
        setShowGoalLines(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // 小餅圖元件
    const MiniPieChart = ({ data, title }: { data: { name: string; value: number; color: string }[]; title: string }) => {
        if (data.length === 0) return null;
        const total = data.reduce((acc, d) => acc + d.value, 0);

        return (
            <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">{title}</div>
                <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={45}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => `${(value / 10000).toFixed(1)}萬 (${((value / total) * 100).toFixed(0)}%)`}
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-2">
                    {data.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                <span className="text-gray-400">{d.name}</span>
                            </div>
                            <span className="text-white font-mono">{(d.value / 10000).toFixed(1)}萬</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* 淨值走勢圖 + 目標參考線 */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <TrendingUp size={20} className="text-emerald-400" />
                    <span className="text-lg font-bold text-white">淨值走勢</span>

                    {/* 時間區間選擇 */}
                    {/* 自訂時間輸入 */}
                    {timeRange === 'custom' && (
                        <div className="flex items-center gap-1 bg-gray-900 rounded-lg px-2 py-1 border border-gray-800">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="bg-gray-800 text-white text-xs rounded px-1 outline-none border border-gray-700 focus:border-emerald-500"
                            />
                            <span className="text-gray-500 text-xs">-</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="bg-gray-800 text-white text-xs rounded px-1 outline-none border border-gray-700 focus:border-emerald-500"
                            />
                        </div>
                    )}

                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                        {(['7d', '1m', '3m', '1y', 'all', 'custom'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-2 py-0.5 rounded-full text-xs transition-colors ${timeRange === range ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {range === '7d' ? '7天' : range === '1m' ? '1月' : range === '3m' ? '3月' : range === '1y' ? '1年' : range === 'all' ? '全部' : '自訂'}
                            </button>
                        ))}
                    </div>

                    <span className="text-sm text-gray-500">{filteredSnapshots.length} 筆</span>
                </div>

                {/* 目標線開關 + 預測曲線開關 */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {/* 預測曲線開關 */}
                    <button
                        onClick={() => setShowPredictionLine(!showPredictionLine)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${showPredictionLine
                            ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-600'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                            }`}
                    >
                        {showPredictionLine ? <Eye size={12} /> : <EyeOff size={12} />}
                        📈 預測趨勢
                    </button>

                    {/* 目標線開關 */}
                    {goals.map(goal => (
                        <button
                            key={goal.id}
                            onClick={() => toggleGoalLine(goal.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${showGoalLines[goal.id]
                                ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600'
                                : 'bg-gray-800 text-gray-500 border border-gray-700'
                                }`}
                        >
                            {showGoalLines[goal.id] ? <Eye size={12} /> : <EyeOff size={12} />}
                            {goal.name}
                        </button>
                    ))}
                </div>

                {filteredSnapshots.length > 0 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    {/* 預測曲線漸層 */}
                                    <linearGradient id="predictionGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                    </linearGradient>
                                    {/* 目標區域漸層 */}
                                    {goals.filter(g => showGoalLines[g.id]).map((goal, idx) => (
                                        <linearGradient key={`grad-${goal.id}`} id={`goalGradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={['#f59e0b', '#8b5cf6', '#ec4899'][idx % 3]} stopOpacity={0.15} />
                                            <stop offset="100%" stopColor={['#f59e0b', '#8b5cf6', '#ec4899'][idx % 3]} stopOpacity={0.02} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                                <YAxis
                                    stroke="#6b7280"
                                    fontSize={12}
                                    tickFormatter={(v) => `${v}萬`}
                                    width={60}
                                    tickCount={8}
                                    domain={[
                                        (dataMin: number) => Math.max(0, dataMin * 0.9),
                                        (dataMax: number) => {
                                            // 目標線資料
                                            const activeGoalAmounts = goals
                                                .filter(g => showGoalLines[g.id])
                                                .map(g => g.targetAmount / 10000);
                                            const maxGoal = Math.max(...activeGoalAmounts, 0);

                                            // 如果目標比資料最大值高太多，用智慧比例
                                            if (maxGoal > dataMax * 2) {
                                                // 目標太高時，讓資料佔據圖表 60%，目標在上方 40%
                                                return maxGoal * 1.05;
                                            }
                                            return Math.max(dataMax * 1.15, maxGoal * 1.05);
                                        }
                                    ]}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    formatter={(value: number) => [`${value} 萬`, '淨值']}
                                    labelFormatter={(label) => `日期: ${label}`}
                                />

                                {/* 目標區域背景填充（從0到目標值） */}
                                {goals.filter(g => showGoalLines[g.id]).map((goal, idx) => (
                                    <ReferenceArea
                                        key={`area-${goal.id}`}
                                        y1={0}
                                        y2={goal.targetAmount / 10000}
                                        fill={`url(#goalGradient-${idx})`}
                                        fillOpacity={1}
                                    />
                                ))}

                                {/* 目標參考線 - 更醒目 */}
                                {goals.filter(g => showGoalLines[g.id]).map((goal, idx) => (
                                    <ReferenceLine
                                        key={goal.id}
                                        y={goal.targetAmount / 10000}
                                        stroke={['#f59e0b', '#8b5cf6', '#ec4899'][idx % 3]}
                                        strokeDasharray="8 4"
                                        strokeWidth={2}
                                        label={{
                                            value: `🎯 ${goal.name} (${(goal.targetAmount / 10000).toFixed(0)}萬)`,
                                            position: 'insideTopRight',
                                            fill: ['#f59e0b', '#8b5cf6', '#ec4899'][idx % 3],
                                            fontSize: 11,
                                            fontWeight: 'bold'
                                        }}
                                    />
                                ))}

                                <Area
                                    type="monotone"
                                    dataKey="netWorth"
                                    stroke="#10b981"
                                    fill="url(#netWorthGradient)"
                                    strokeWidth={2}
                                    connectNulls={false}
                                />

                                {/* 預測曲線 */}
                                {showPredictionLine && (
                                    <Area
                                        type="monotone"
                                        dataKey="prediction"
                                        stroke="#06b6d4"
                                        fill="url(#predictionGradient)"
                                        strokeWidth={2}
                                        strokeDasharray="5 3"
                                        connectNulls={false}
                                    />
                                )}

                                {/* 縮放拖曳元件 */}
                                <Brush
                                    dataKey="date"
                                    height={30}
                                    stroke="#6b7280"
                                    fill="#1f2937"
                                    travellerWidth={10}
                                    tickFormatter={(v) => v}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
                            <p>尚無歷史紀錄</p>
                            <p className="text-sm">第一筆快照將在下午 4 點後自動建立</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 資產配置 (可展開) */}
            {breakdown && (
                <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChartIcon size={20} className="text-purple-400" />
                        <span className="text-lg font-bold text-white">資產配置</span>
                        {utilization && (
                            <div className="ml-auto text-xs text-gray-400">
                                總運用率: {((utilization.stock + utilization.usStock + utilization.crypto) / 3).toFixed(0)}%
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 台幣圈 - 可展開 */}
                        <div
                            className={`bg-gray-800 rounded-lg p-3 cursor-pointer transition-all hover:ring-1 hover:ring-emerald-500 ${expandedSection === 'twd' ? 'ring-1 ring-emerald-500' : ''}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedSection(expandedSection === 'twd' ? null : 'twd'); }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">🇹🇼 台幣圈</span>
                                {utilization && <span className="text-xs text-emerald-400" title="資金運用率">{(utilization.stock * 100).toFixed(0)}%</span>}
                            </div>
                            <div className="h-20">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData.twd} cx="50%" cy="50%" innerRadius={18} outerRadius={35} paddingAngle={2} dataKey="value">
                                            {pieData.twd.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-1 mt-1">
                                {pieData.twd.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-gray-400 truncate">{d.name}</span></div>
                                        <span className="text-white font-mono">{(d.value / 10000).toFixed(1)}萬</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 美金圈 - 可展開 */}
                        <div
                            className={`bg-gray-800 rounded-lg p-3 cursor-pointer transition-all hover:ring-1 hover:ring-blue-500 ${expandedSection === 'usd' ? 'ring-1 ring-blue-500' : ''}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedSection(expandedSection === 'usd' ? null : 'usd'); }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">🇺🇸 美金圈</span>
                                {utilization && <span className="text-xs text-blue-400" title="資金運用率">{(utilization.usStock * 100).toFixed(0)}%</span>}
                            </div>
                            <div className="h-20">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData.usd} cx="50%" cy="50%" innerRadius={18} outerRadius={35} paddingAngle={2} dataKey="value">
                                            {pieData.usd.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-1 mt-1">
                                {pieData.usd.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-gray-400 truncate">{d.name}</span></div>
                                        <span className="text-white font-mono">{(d.value / 10000).toFixed(1)}萬</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* USDT圈 - 可展開 */}
                        <button
                            type="button"
                            className={`bg-gray-800 rounded-lg p-3 cursor-pointer transition-all hover:ring-1 hover:ring-pink-500 w-full text-left ${expandedSection === 'usdt' ? 'ring-1 ring-pink-500' : ''}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedSection(expandedSection === 'usdt' ? null : 'usdt'); }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">₿ USDT圈</span>
                                {utilization && <span className="text-xs text-pink-400" title="資金運用率">{(utilization.crypto * 100).toFixed(0)}%</span>}
                            </div>
                            <div className="h-20 pointer-events-none">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData.usdt} cx="50%" cy="50%" innerRadius={18} outerRadius={35} paddingAngle={2} dataKey="value">
                                            {pieData.usdt.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-1 mt-1">
                                {pieData.usdt.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-gray-400 truncate">{d.name}</span></div>
                                        <span className="text-white font-mono">{(d.value / 10000).toFixed(1)}萬</span>
                                    </div>
                                ))}
                            </div>
                        </button>

                        {/* 身家負債 - 可展開 */}
                        <div
                            className={`bg-gray-800 rounded-lg p-3 cursor-pointer transition-all hover:ring-1 hover:ring-yellow-500 ${expandedSection === 'total' ? 'ring-1 ring-yellow-500' : ''}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedSection(expandedSection === 'total' ? null : 'total'); }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">💰 身家負債</span>
                            </div>
                            <div className="h-20">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData.total} cx="50%" cy="50%" innerRadius={18} outerRadius={35} paddingAngle={2} dataKey="value">
                                            {pieData.total.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-1 mt-1">
                                {pieData.total.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-gray-400 truncate">{d.name}</span></div>
                                        <span className="text-white font-mono">{(d.value / 10000).toFixed(1)}萬</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 展開細節區塊 */}
                    {expandedSection && (
                        <div className="mt-4 bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-white">
                                    {expandedSection === 'twd' && '🇹🇼 台股持倉細節'}
                                    {expandedSection === 'usd' && '🇺🇸 美股持倉細節'}
                                    {expandedSection === 'usdt' && '₿ 幣圈持倉細節'}
                                    {expandedSection === 'total' && '💰 負債明細'}
                                </span>
                                <button onClick={() => setExpandedSection(null)} className="text-gray-500 hover:text-white">&times;</button>
                            </div>

                            {/* 台股細節 */}
                            {expandedSection === 'twd' && stockPositions && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {stockPositions.length > 0 ? stockPositions.map((stock, i) => {
                                        const value = stock.price * stock.shares;
                                        const pnl = (stock.price - stock.costPrice) * stock.shares;
                                        const pnlPercent = stock.costPrice > 0 ? ((stock.price - stock.costPrice) / stock.costPrice) * 100 : 0;
                                        const totalStockValue = stockPositions.reduce((acc, s) => acc + s.price * s.shares, 0);
                                        const percent = totalStockValue > 0 ? (value / totalStockValue) * 100 : 0;

                                        return (
                                            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-700">
                                                <div>
                                                    <span className="text-white">{stock.name}</span>
                                                    {stock.isMargin && <span className="ml-1 text-xs bg-orange-600 rounded px-1">槓</span>}
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-gray-400 text-xs">{stock.shares}股 × ${stock.price}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-mono">{(value / 10000).toFixed(1)}萬</span>
                                                        <span className="text-gray-500">({percent.toFixed(0)}%)</span>
                                                        <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }) : <div className="text-gray-500 text-sm">尚無台股持倉</div>}
                                </div>
                            )}

                            {/* 美股細節 */}
                            {expandedSection === 'usd' && usStockPositions && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {cashUsd && cashUsd > 0 && (
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-gray-700">
                                            <span className="text-white">💵 美金現金</span>
                                            <span className="text-white font-mono">${cashUsd.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {usStockPositions.length > 0 ? usStockPositions.map((stock, i) => {
                                        const value = stock.price * stock.shares;
                                        const pnl = (stock.price - stock.costPrice) * stock.shares;
                                        const pnlPercent = stock.costPrice > 0 ? ((stock.price - stock.costPrice) / stock.costPrice) * 100 : 0;
                                        const totalValue = usStockPositions.reduce((acc, s) => acc + s.price * s.shares, 0);
                                        const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;

                                        return (
                                            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-700">
                                                <span className="text-white font-bold">{stock.symbol}</span>
                                                <div className="text-right">
                                                    <div className="text-gray-400 text-xs">{stock.shares}股 × ${stock.price.toFixed(2)}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-mono">${value.toLocaleString()}</span>
                                                        <span className="text-gray-500">({percent.toFixed(0)}%)</span>
                                                        <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }) : <div className="text-gray-500 text-sm">尚無美股持倉</div>}
                                </div>
                            )}

                            {/* 幣圈細節 */}
                            {expandedSection === 'usdt' && cryptoPositions && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {cryptoPositions.length > 0 ? cryptoPositions.map((pos, i) => {
                                        if (!pos || !pos.symbol) return null;
                                        const isLong = pos.type === 'long';
                                        const isSpot = pos.type === 'spot';
                                        const leverage = pos.leverage || 1;
                                        const entryPrice = pos.entryPrice || 0;
                                        const currentPrice = pos.currentPrice || 0;

                                        // 顯示倉位大小：合約用 margin，現貨用 units * currentPrice
                                        const displayValue = isSpot
                                            ? (pos.units || 0) * currentPrice
                                            : (pos.positionSize || pos.margin || 0);

                                        // 使用已計算好的損益率
                                        const pnlPercent = pos.pnlPercent || 0;
                                        const pnl = pos.pnl || 0;

                                        return (
                                            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-700">
                                                <div>
                                                    <span className="text-white font-bold">{pos.symbol.replace('USDT', '')}</span>
                                                    <span className={`ml-1 text-xs ${isSpot ? 'text-blue-400' : isLong ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {isSpot ? '💎 現貨' : isLong ? '🟢 L' : '🔴 S'} {!isSpot && `${leverage}x`}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-gray-400 text-xs">
                                                        {isSpot
                                                            ? `${(pos.units || 0).toFixed(4)} @ $${entryPrice.toFixed(2)}`
                                                            : `₮${(pos.margin || 0).toLocaleString()} @ $${entryPrice.toFixed(2)}`
                                                        }
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-mono">${currentPrice.toFixed(2)}</span>
                                                        <span className={pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }) : <div className="text-gray-500 text-sm">尚無幣圈持倉</div>}
                                </div>
                            )}

                            {/* 負債細節 */}
                            {expandedSection === 'total' && debts && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {debts.length > 0 ? debts.map((debt, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-700">
                                            <span className="text-white">{debt.name}</span>
                                            <span className="text-red-400 font-mono">-{(debt.amount / 10000).toFixed(1)}萬</span>
                                        </div>
                                    )) : <div className="text-gray-500 text-sm">無負債紀錄</div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 資產膨脹預測 */}
            {(growthAnalysis || snapshots.length > 0) && (
                <div className="glass-card rounded-2xl p-6 hover-lift">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                                <Calculator size={16} className="text-white" />
                            </div>
                            <span className="text-lg font-bold text-white font-cyber">資產膨脹預測</span>
                        </div>

                        {/* 區間選擇器 */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">計算範圍:</span>
                            <input
                                type="number"
                                min="0"
                                value={growthRangeValue || ''}
                                onChange={e => setGrowthRangeValue(parseInt(e.target.value) || 0)}
                                placeholder="全部"
                                className="w-16 glass-card-dark border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-cyan-500/50 font-cyber text-center"
                            />
                            <select
                                value={growthRangeUnit}
                                onChange={e => setGrowthRangeUnit(e.target.value as 'day' | 'month' | 'year')}
                                disabled={growthRangeValue === 0}
                                className="glass-card-dark border border-gray-700/50 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-cyan-500/50 disabled:opacity-50"
                            >
                                <option value="day">日</option>
                                <option value="month">月</option>
                                <option value="year">年</option>
                            </select>
                            <span className="text-xs text-gray-500">
                                ({growthAnalysis ? `${growthAnalysis.days} 天` : '無數據'})
                            </span>
                        </div>
                    </div>

                    {!growthAnalysis && (
                        <div className="text-center text-gray-500 py-8">
                            選定區間內數據不足（需至少 2 筆快照）
                        </div>
                    )}

                    {growthAnalysis && (
                        <>

                            {/* 公式說明 */}
                            <details className="mb-4 text-xs glass-card-dark rounded-lg border border-gray-700/50">
                                <summary className="cursor-pointer px-3 py-2 text-cyan-400 hover:text-cyan-300">📐 查看計算公式與原始數據</summary>
                                <div className="px-3 pb-3 pt-1 space-y-2 text-gray-400">
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-700">
                                        <div><span className="text-gray-500">起始日期:</span> <span className="text-white font-mono">{growthAnalysis.firstDate}</span></div>
                                        <div><span className="text-gray-500">結束日期:</span> <span className="text-white font-mono">{growthAnalysis.lastDate}</span></div>
                                        <div><span className="text-gray-500">起始淨值:</span> <span className="text-white font-mono">{(growthAnalysis.firstNetWorth / 10000).toFixed(2)}萬</span></div>
                                        <div><span className="text-gray-500">結束淨值:</span> <span className="text-white font-mono">{(growthAnalysis.lastNetWorth / 10000).toFixed(2)}萬</span></div>
                                    </div>
                                    <div className="space-y-1">
                                        <div><span className="text-yellow-400">區間變化</span> = 結束淨值 - 起始淨值 = {(growthAnalysis.lastNetWorth / 10000).toFixed(2)} - {(growthAnalysis.firstNetWorth / 10000).toFixed(2)} = <span className="text-emerald-400 font-mono">{(growthAnalysis.change / 10000).toFixed(2)}萬</span></div>
                                        <div><span className="text-yellow-400">區間變化%</span> = (變化 ÷ 起始淨值) × 100 = ({(growthAnalysis.change / 10000).toFixed(2)} ÷ {(growthAnalysis.firstNetWorth / 10000).toFixed(2)}) × 100 = <span className="text-emerald-400 font-mono">{growthAnalysis.changePercent.toFixed(2)}%</span></div>
                                        <div><span className="text-yellow-400">日均成長率</span> = 區間變化% ÷ 天數 = {growthAnalysis.changePercent.toFixed(2)} ÷ {growthAnalysis.days} = <span className="text-emerald-400 font-mono">{growthAnalysis.dailyGrowthRate.toFixed(4)}%</span></div>
                                        <div><span className="text-yellow-400">月成長率</span> = 日均成長率 × 30 = {growthAnalysis.dailyGrowthRate.toFixed(4)} × 30 = <span className="text-emerald-400 font-mono">{growthAnalysis.monthlyGrowthRate.toFixed(2)}%</span></div>
                                        <div><span className="text-yellow-400">年化成長率</span> = 日均成長率 × 365 = {growthAnalysis.dailyGrowthRate.toFixed(4)} × 365 = <span className="text-emerald-400 font-mono">{growthAnalysis.annualizedRate.toFixed(2)}%</span></div>
                                    </div>
                                    <div className="pt-2 border-t border-gray-700 text-gray-500">
                                        ⚠️ 注意：這是簡單線性推算，僅供參考。實際成長會受市場波動影響。
                                    </div>
                                </div>
                            </details>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="glass-card-dark rounded-xl p-4 border border-gray-700/50 hover-lift">
                                    <div className="text-xs text-gray-500 mb-1">區間變化</div>
                                    <div className={`text-2xl font-bold font-cyber animate-count ${growthAnalysis.change >= 0 ? 'text-gradient-emerald' : 'text-red-400'}`}>
                                        {growthAnalysis.change >= 0 ? '+' : ''}{(growthAnalysis.change / 10000).toFixed(1)}萬
                                    </div>
                                    <div className="text-xs text-emerald-400 mt-1">
                                        {growthAnalysis.changePercent >= 0 ? '+' : ''}{growthAnalysis.changePercent.toFixed(1)}%
                                    </div>
                                </div>

                                <div className="glass-card-dark rounded-xl p-4 border border-gray-700/50 hover-lift">
                                    <div className="text-xs text-gray-500 mb-1">月成長率</div>
                                    <div className={`text-2xl font-bold font-cyber animate-count ${growthAnalysis.monthlyGrowthRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {growthAnalysis.monthlyGrowthRate >= 0 ? '+' : ''}{growthAnalysis.monthlyGrowthRate.toFixed(1)}%
                                    </div>
                                </div>

                                <div className="glass-card-dark rounded-xl p-4 border border-gray-700/50 hover-lift">
                                    <div className="text-xs text-gray-500 mb-1">年化成長率</div>
                                    <div className={`text-2xl font-bold font-cyber animate-count ${growthAnalysis.annualizedRate >= 0 ? 'text-gradient-cyan' : 'text-red-400'}`}>
                                        {growthAnalysis.annualizedRate >= 0 ? '+' : ''}{growthAnalysis.annualizedRate.toFixed(0)}%
                                    </div>
                                </div>

                                <div className="glass-card-dark rounded-xl p-4 border border-gray-700/50 hover-lift">
                                    <div className="text-xs text-gray-500 mb-1">日均成長</div>
                                    <div className={`text-2xl font-bold font-cyber animate-count ${growthAnalysis.dailyGrowthRate >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                                        {growthAnalysis.dailyGrowthRate >= 0 ? '+' : ''}{growthAnalysis.dailyGrowthRate.toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            {/* 目標達成預估 - 美化版 */}
                            {growthAnalysis.goalProjections.length > 0 && (
                                <div className="border-t border-gray-700/50 pt-5">
                                    <div className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                                        🎯 目標達成預估
                                    </div>
                                    <div className="space-y-4">
                                        {growthAnalysis.goalProjections.map(({ goal, daysToGoal, achieved }, index) => {
                                            const progress = Math.min((currentNetWorth / goal.targetAmount) * 100, 100);
                                            const gradients = [
                                                'from-yellow-500 to-orange-500',
                                                'from-purple-500 to-violet-500',
                                                'from-pink-500 to-rose-500'
                                            ];
                                            const icons = ['🏆', '🚀', '💎'];

                                            return (
                                                <div key={goal.id} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${gradients[index % 3]} flex items-center justify-center text-xs shadow-lg`}>
                                                            {icons[index % 3]}
                                                        </div>
                                                        <div>
                                                            <div className="text-white font-medium">{goal.name}</div>
                                                            <div className="w-32 h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                                                                <div
                                                                    className={`h-full bg-gradient-to-r ${gradients[index % 3]} rounded-full animate-progress`}
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-sm font-mono ${achieved ? 'text-yellow-400' : daysToGoal === Infinity ? 'text-red-400' : 'text-cyan-400'}`}>
                                                        {achieved
                                                            ? '🎉 已達成'
                                                            : daysToGoal === Infinity
                                                                ? '成長率不足'
                                                                : `約 ${Math.floor(daysToGoal / 365)} 年 ${Math.floor((daysToGoal % 365) / 30)} 月後`
                                                        }
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {waveAnalysis && (
                <div className="glass-card rounded-2xl p-6 hover-lift">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                            <BarChart3 size={16} className="text-white" />
                        </div>
                        <span className="text-lg font-bold text-white font-cyber">波段分析</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-card-dark rounded-xl p-4 border border-gray-700/50 hover-lift">
                            <div className="text-xs text-gray-500 mb-1">目前淨值</div>
                            <div className="text-2xl font-bold text-white font-cyber animate-count">
                                {(currentNetWorth / 10000).toFixed(1)}萬
                            </div>
                        </div>

                        <div className="glass-card-dark rounded-xl p-4 border-glow-emerald hover-lift">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <ArrowUp size={12} className="text-emerald-400" /> 歷史最高
                            </div>
                            <div className="text-2xl font-bold text-emerald-400 font-cyber animate-count">
                                {(waveAnalysis.allTimeHigh / 10000).toFixed(1)}萬
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{waveAnalysis.highDate}</div>
                        </div>

                        <div className="glass-card-dark rounded-xl p-4 border border-red-500/30 hover-lift">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <ArrowDown size={12} className="text-red-400" /> 歷史最低
                            </div>
                            <div className="text-2xl font-bold text-red-400 font-cyber animate-count">
                                {(waveAnalysis.allTimeLow / 10000).toFixed(1)}萬
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{waveAnalysis.lowDate}</div>
                        </div>

                        <div className="glass-card-dark rounded-xl p-4 border-glow-cyan hover-lift" title="0% = 歷史最低, 100% = 歷史最高">
                            <div className="text-xs text-gray-500 mb-1">波段位置 📊</div>
                            <div className="text-2xl font-bold text-gradient-cyan font-cyber animate-count">
                                {waveAnalysis.currentPosition.toFixed(0)}%
                            </div>
                            <div className="text-xs text-gray-500 mb-2">（歷史低點↔高點）</div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full rounded-full animate-progress"
                                    style={{
                                        width: `${waveAnalysis.currentPosition}%`,
                                        background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 30%, #22c55e 100%)'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-4 text-sm">
                        <span className="text-red-400">離高點: -{waveAnalysis.distanceFromHigh.toFixed(1)}%</span>
                        <span className="text-emerald-400">離低點: +{waveAnalysis.distanceFromLow.toFixed(1)}%</span>
                    </div>
                </div>
            )}

            {/* 目標追蹤 */}
            <div className="glass-card rounded-2xl p-6 hover-lift">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                        <Target size={16} className="text-white" />
                    </div>
                    <span className="text-lg font-bold text-white font-cyber">目標追蹤</span>
                </div>

                {/* 目標列表 */}
                <div className="space-y-4 mb-6">
                    {goals.map(goal => {
                        const { progress, remaining, isAchieved } = checkGoalProgress(goal, currentNetWorth);
                        return (
                            <div key={goal.id} className={`glass-card-dark rounded-xl p-4 ${isAchieved ? 'border-glow-yellow pulse-glow' : 'border border-gray-700/50'} hover-lift`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        {isAchieved ? (
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                                                <Award size={14} className="text-white" />
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                                                <Target size={12} className="text-gray-400" />
                                            </div>
                                        )}
                                        <span className={`font-bold ${isAchieved ? 'text-gradient-gold' : 'text-white'}`}>
                                            {goal.name}
                                        </span>

                                        {/* 顯示在圖表開關 */}
                                        <button
                                            onClick={() => toggleGoalLine(goal.id)}
                                            className={`text-xs px-2 py-0.5 rounded-full transition-all ${showGoalLines[goal.id] ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-gray-700 text-gray-500 border border-gray-600'}`}
                                            title="在圖表顯示"
                                        >
                                            {showGoalLines[goal.id] ? <Eye size={10} /> : <EyeOff size={10} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteGoal(goal.id)}
                                        className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-gray-400">
                                        目標: <span className="font-cyber text-white">{(goal.targetAmount / 10000).toFixed(0)}萬</span>
                                    </span>
                                    <span className={isAchieved ? 'text-yellow-400' : 'text-emerald-400'}>
                                        {isAchieved ? '🎉 已達成!' : `還差 ${(remaining / 10000).toFixed(1)}萬`}
                                    </span>
                                </div>

                                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full animate-progress ${isAchieved
                                            ? 'bg-gradient-to-r from-yellow-500 to-orange-400'
                                            : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                                            }`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="text-right text-xs text-gray-500 mt-1 font-cyber">{progress.toFixed(1)}%</div>
                            </div>
                        );
                    })}

                    {goals.length === 0 && (
                        <div className="text-center text-gray-500 py-8 glass-card-dark rounded-xl">
                            尚未設定目標，立即設定你的財富目標！
                        </div>
                    )}
                </div>

                {/* 新增目標表單 */}
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newGoalName}
                        onChange={e => setNewGoalName(e.target.value)}
                        placeholder="目標名稱"
                        className="flex-1 glass-card-dark border border-gray-700/50 rounded-xl px-4 py-2.5 text-white outline-none focus:border-yellow-500/50 focus:glow-yellow transition-all"
                    />
                    <input
                        type="number"
                        value={newGoalAmount}
                        onChange={e => setNewGoalAmount(e.target.value)}
                        placeholder="金額(萬)"
                        className="w-28 glass-card-dark border border-gray-700/50 rounded-xl px-4 py-2.5 text-white outline-none focus:border-yellow-500/50 focus:glow-yellow transition-all font-cyber"
                    />
                    <button
                        onClick={handleAddGoal}
                        className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-yellow-500/25 btn-press"
                    >
                        <Plus size={16} /> 新增
                    </button>
                </div>
            </div>
        </div>
    );
};
