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
    usdTwdRate = 31.5
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
    const [timeRange, setTimeRange] = useState<'7d' | '1m' | '3m' | '1y' | 'all'>(() => {
        try {
            const saved = localStorage.getItem('tianji_timeRange');
            return (saved as '7d' | '1m' | '3m' | '1y' | 'all') || 'all';
        } catch { return 'all'; }
    });

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

    useEffect(() => {
        setSnapshots(getSnapshots());
        setGoals(getGoals());
        setWaveAnalysis(getWaveAnalysis());
    }, []);

    // 初始化目標線開關
    useEffect(() => {
        const initial: Record<string, boolean> = {};
        goals.forEach(g => { initial[g.id] = true; });
        setShowGoalLines(initial);
    }, [goals]);

    // 根據時間區間過濾快照
    const filteredSnapshots = useMemo(() => {
        if (timeRange === 'all') return snapshots;

        const now = new Date();
        const cutoff = new Date();

        switch (timeRange) {
            case '7d': cutoff.setDate(now.getDate() - 7); break;
            case '1m': cutoff.setMonth(now.getMonth() - 1); break;
            case '3m': cutoff.setMonth(now.getMonth() - 3); break;
            case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
        }

        return snapshots.filter(s => new Date(s.id) >= cutoff);
    }, [snapshots, timeRange]);

    // 格式化圖表資料
    const chartData = filteredSnapshots.map(s => ({
        date: s.id.slice(5), // MM-DD
        netWorth: Math.round(s.netWorth / 10000), // 萬
        fullDate: s.id
    }));

    // 資產膨脹預測
    const growthAnalysis = useMemo(() => {
        if (filteredSnapshots.length < 2) return null;

        const first = filteredSnapshots[0];
        const last = filteredSnapshots[filteredSnapshots.length - 1];
        const days = Math.max(1, Math.ceil((new Date(last.id).getTime() - new Date(first.id).getTime()) / (1000 * 60 * 60 * 24)));

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
            goalProjections
        };
    }, [filteredSnapshots, goals, currentNetWorth]);

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
                    <div className="flex items-center gap-1 ml-auto bg-gray-800 rounded-full p-1">
                        {(['7d', '1m', '3m', '1y', 'all'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-2 py-0.5 rounded-full text-xs transition-colors ${timeRange === range ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {range === '7d' ? '7天' : range === '1m' ? '1月' : range === '3m' ? '3月' : range === '1y' ? '1年' : '全部'}
                            </button>
                        ))}
                    </div>

                    <span className="text-sm text-gray-500">{filteredSnapshots.length} 筆</span>
                </div>

                {/* 目標線開關 */}
                {goals.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
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
                )}

                {filteredSnapshots.length > 0 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                                />

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
            {growthAnalysis && (
                <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                        <Calculator size={20} className="text-cyan-400" />
                        <span className="text-lg font-bold text-white">資產膨脹預測</span>
                        <span className="text-xs text-gray-500 ml-auto">基於 {growthAnalysis.days} 天數據</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-500">區間變化</div>
                            <div className={`text-lg font-bold font-mono ${growthAnalysis.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthAnalysis.change >= 0 ? '+' : ''}{(growthAnalysis.change / 10000).toFixed(1)}萬
                            </div>
                            <div className="text-xs text-gray-500">
                                {growthAnalysis.changePercent >= 0 ? '+' : ''}{growthAnalysis.changePercent.toFixed(1)}%
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-500">月成長率</div>
                            <div className={`text-lg font-bold font-mono ${growthAnalysis.monthlyGrowthRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthAnalysis.monthlyGrowthRate >= 0 ? '+' : ''}{growthAnalysis.monthlyGrowthRate.toFixed(1)}%
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-500">年化成長率</div>
                            <div className={`text-lg font-bold font-mono ${growthAnalysis.annualizedRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthAnalysis.annualizedRate >= 0 ? '+' : ''}{growthAnalysis.annualizedRate.toFixed(0)}%
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-500">日均成長</div>
                            <div className={`text-lg font-bold font-mono ${growthAnalysis.dailyGrowthRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {growthAnalysis.dailyGrowthRate >= 0 ? '+' : ''}{growthAnalysis.dailyGrowthRate.toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    {/* 目標達成預估 */}
                    {growthAnalysis.goalProjections.length > 0 && (
                        <div className="border-t border-gray-700 pt-4">
                            <div className="text-sm text-gray-400 mb-2 flex items-center gap-1">
                                <Clock size={14} /> 目標達成預估
                            </div>
                            <div className="space-y-2">
                                {growthAnalysis.goalProjections.map(({ goal, daysToGoal, achieved }) => (
                                    <div key={goal.id} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">{goal.name} ({(goal.targetAmount / 10000).toFixed(0)}萬)</span>
                                        <span className={achieved ? 'text-yellow-400' : daysToGoal === Infinity ? 'text-red-400' : 'text-cyan-400'}>
                                            {achieved
                                                ? '🎉 已達成'
                                                : daysToGoal === Infinity
                                                    ? '成長率不足'
                                                    : `約 ${Math.floor(daysToGoal / 365)} 年 ${Math.floor((daysToGoal % 365) / 30)} 月後`
                                            }
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 波段分析 */}
            {waveAnalysis && (
                <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={20} className="text-cyan-400" />
                        <span className="text-lg font-bold text-white">波段分析</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">目前淨值</div>
                            <div className="text-xl font-bold text-white font-mono">
                                {(currentNetWorth / 10000).toFixed(1)}萬
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <ArrowUp size={12} className="text-emerald-400" /> 歷史最高
                            </div>
                            <div className="text-lg font-bold text-emerald-400 font-mono">
                                {(waveAnalysis.allTimeHigh / 10000).toFixed(1)}萬
                            </div>
                            <div className="text-xs text-gray-500">{waveAnalysis.highDate}</div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <ArrowDown size={12} className="text-red-400" /> 歷史最低
                            </div>
                            <div className="text-lg font-bold text-red-400 font-mono">
                                {(waveAnalysis.allTimeLow / 10000).toFixed(1)}萬
                            </div>
                            <div className="text-xs text-gray-500">{waveAnalysis.lowDate}</div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-3" title="0% = 歷史最低, 100% = 歷史最高">
                            <div className="text-xs text-gray-500 mb-1">波段位置 📊</div>
                            <div className="text-lg font-bold text-cyan-400 font-mono">
                                {waveAnalysis.currentPosition.toFixed(0)}%
                            </div>
                            <div className="text-xs text-gray-500 mb-1">（歷史低點↔高點）</div>
                            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                                <div
                                    className="bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 h-2 rounded-full transition-all"
                                    style={{ width: `${waveAnalysis.currentPosition}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 text-sm text-gray-400 space-x-4">
                        <span className="text-red-400">離高點: -{waveAnalysis.distanceFromHigh.toFixed(1)}%</span>
                        <span className="text-emerald-400">離低點: +{waveAnalysis.distanceFromLow.toFixed(1)}%</span>
                    </div>
                </div>
            )}

            {/* 目標追蹤 */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                    <Target size={20} className="text-yellow-400" />
                    <span className="text-lg font-bold text-white">目標追蹤</span>
                </div>

                {/* 目標列表 */}
                <div className="space-y-3 mb-4">
                    {goals.map(goal => {
                        const { progress, remaining, isAchieved } = checkGoalProgress(goal, currentNetWorth);
                        return (
                            <div key={goal.id} className="bg-gray-800 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {isAchieved ? (
                                            <Award size={16} className="text-yellow-400" />
                                        ) : (
                                            <Target size={16} className="text-gray-400" />
                                        )}
                                        <span className={`font-bold ${isAchieved ? 'text-yellow-400' : 'text-white'}`}>
                                            {goal.name}
                                        </span>

                                        {/* 顯示在圖表開關 */}
                                        <button
                                            onClick={() => toggleGoalLine(goal.id)}
                                            className={`text-xs px-1.5 py-0.5 rounded ${showGoalLines[goal.id] ? 'bg-yellow-600/30 text-yellow-400' : 'bg-gray-700 text-gray-500'}`}
                                            title="在圖表顯示"
                                        >
                                            {showGoalLines[goal.id] ? <Eye size={10} /> : <EyeOff size={10} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteGoal(goal.id)}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-gray-400">
                                        目標: {(goal.targetAmount / 10000).toFixed(0)}萬
                                    </span>
                                    <span className={isAchieved ? 'text-yellow-400' : 'text-emerald-400'}>
                                        {isAchieved ? '🎉 已達成!' : `還差 ${(remaining / 10000).toFixed(1)}萬`}
                                    </span>
                                </div>

                                <div className="w-full bg-gray-700 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all ${isAchieved
                                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-300'
                                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                                            }`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="text-right text-xs text-gray-500 mt-1">{progress.toFixed(1)}%</div>
                            </div>
                        );
                    })}

                    {goals.length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                            尚未設定目標
                        </div>
                    )}
                </div>

                {/* 新增目標表單 */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newGoalName}
                        onChange={e => setNewGoalName(e.target.value)}
                        placeholder="目標名稱"
                        className="flex-1 bg-gray-700 rounded px-3 py-2 text-white outline-none focus:ring-1 ring-yellow-500"
                    />
                    <input
                        type="number"
                        value={newGoalAmount}
                        onChange={e => setNewGoalAmount(e.target.value)}
                        placeholder="金額(萬)"
                        className="w-24 bg-gray-700 rounded px-3 py-2 text-white outline-none focus:ring-1 ring-yellow-500"
                    />
                    <button
                        onClick={handleAddGoal}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded flex items-center gap-1 transition-colors"
                    >
                        <Plus size={16} /> 新增
                    </button>
                </div>
            </div>
        </div>
    );
};
