import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChevronDown, ChevronUp, PieChartIcon } from 'lucide-react';
import { StockPosition, USStockPosition, CryptoPosition } from '../types';
import { TianJiCard } from './TianJiCard';

interface AllocationChartProps {
    // 現金
    cashTwd: number;
    cashUsd: number;
    cashUsdt: number;
    // 匯率
    usdTwdRate: number;
    usdtTwdRate: number;
    // 持倉
    stockPositions: StockPosition[];
    usStockPositions: USStockPosition[];
    cryptoPositions: CryptoPosition[];
}

// 配色方案：冷色=安全資產，暖色=風險資產
const COLORS = {
    // 冷色 (安全/防守)
    cash: '#22d3ee',      // cyan-400
    spot: '#34d399',      // emerald-400
    pledge: '#60a5fa',    // blue-400

    // 暖色 (風險/攻擊)
    margin: '#f87171',    // red-400
    future: '#fb923c',    // orange-400
    usMargin: '#fbbf24',  // amber-400

    // 中性
    usStock: '#a78bfa',   // violet-400
    stock: '#4ade80',     // green-400
};

interface ChartDataItem {
    name: string;
    value: number;
    color: string;
    isRisk: boolean;
    details?: { name: string; value: number; percent: number }[];
}

export const AllocationChart: React.FC<AllocationChartProps> = ({
    cashTwd,
    cashUsd,
    cashUsdt,
    usdTwdRate,
    usdtTwdRate,
    stockPositions,
    usStockPositions,
    cryptoPositions,
}) => {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    // 計算各類資產價值 (TWD)
    const cashUsdTwd = cashUsd * usdTwdRate;
    const cashUsdtTwd = cashUsdt * usdtTwdRate;
    const totalCash = cashTwd + cashUsdTwd + cashUsdtTwd;

    // 台股：區分融資 vs 現股
    const marginStocks = stockPositions.filter(s => s.isMargin);
    const spotStocks = stockPositions.filter(s => !s.isMargin);
    const marginStockValue = marginStocks.reduce((acc, s) => acc + s.price * s.shares, 0);
    const spotStockValue = spotStocks.reduce((acc, s) => acc + s.price * s.shares, 0);

    // 美股
    const usStockValue = usStockPositions.reduce((acc, s) => acc + s.price * s.shares, 0) * usdTwdRate;
    const usMarginValue = usStockPositions.filter(s => s.isMargin).reduce((acc, s) => acc + s.price * s.shares, 0) * usdTwdRate;
    const usSpotValue = usStockValue - usMarginValue;

    // 幣圈：區分現貨 vs 合約
    const spotCrypto = cryptoPositions.filter(p => p.type === 'SPOT');
    const futureCrypto = cryptoPositions.filter(p => p.type === 'FUTURE');
    const spotCryptoValue = spotCrypto.reduce((acc, p) => acc + p.units * p.currentPrice, 0) * usdtTwdRate;
    const futureCryptoValue = futureCrypto.reduce((acc, p) => acc + p.positionSize, 0) * usdtTwdRate;

    // 總資產
    const totalAssets = totalCash + marginStockValue + spotStockValue + usStockValue + spotCryptoValue + futureCryptoValue;

    if (totalAssets <= 0) {
        return (
            <TianJiCard title="資產配置" icon={<PieChartIcon size={20} />} className="h-full">
                <div className="text-center text-gray-500 py-8">尚無資產數據</div>
            </TianJiCard>
        );
    }

    // 構建圖表數據
    const chartData: ChartDataItem[] = [
        {
            name: '現金',
            value: totalCash,
            color: COLORS.cash,
            isRisk: false,
            details: [
                { name: '台幣', value: cashTwd, percent: cashTwd / totalAssets * 100 },
                { name: '美金', value: cashUsdTwd, percent: cashUsdTwd / totalAssets * 100 },
                { name: 'USDT', value: cashUsdtTwd, percent: cashUsdtTwd / totalAssets * 100 },
            ].filter(d => d.value > 0),
        },
        {
            name: '台股現股',
            value: spotStockValue,
            color: COLORS.spot,
            isRisk: false,
            details: spotStocks.map(s => ({
                name: s.name,
                value: s.price * s.shares,
                percent: (s.price * s.shares) / totalAssets * 100,
            })),
        },
        {
            name: '台股融資',
            value: marginStockValue,
            color: COLORS.margin,
            isRisk: true,
            details: marginStocks.map(s => ({
                name: s.name,
                value: s.price * s.shares,
                percent: (s.price * s.shares) / totalAssets * 100,
            })),
        },
        {
            name: '美股',
            value: usStockValue,
            color: usMarginValue > 0 ? COLORS.usMargin : COLORS.usStock,
            isRisk: usMarginValue > 0,
            details: usStockPositions.map(s => ({
                name: `${s.symbol}${s.isMargin ? ' (M)' : ''}`,
                value: s.price * s.shares * usdTwdRate,
                percent: (s.price * s.shares * usdTwdRate) / totalAssets * 100,
            })),
        },
        {
            name: '幣圈現貨',
            value: spotCryptoValue,
            color: COLORS.spot,
            isRisk: false,
            details: spotCrypto.map(p => ({
                name: p.symbol,
                value: p.units * p.currentPrice * usdtTwdRate,
                percent: (p.units * p.currentPrice * usdtTwdRate) / totalAssets * 100,
            })),
        },
        {
            name: '幣圈合約',
            value: futureCryptoValue,
            color: COLORS.future,
            isRisk: true,
            details: futureCrypto.map(p => ({
                name: `${p.symbol} ${p.leverage}x`,
                value: p.positionSize * usdtTwdRate,
                percent: (p.positionSize * usdtTwdRate) / totalAssets * 100,
            })),
        },
    ].filter(d => d.value > 0);

    // 計算攻守佔比
    const riskValue = chartData.filter(d => d.isRisk).reduce((acc, d) => acc + d.value, 0);
    const safeValue = chartData.filter(d => !d.isRisk).reduce((acc, d) => acc + d.value, 0);
    const riskPercent = (riskValue / totalAssets) * 100;
    const safePercent = (safeValue / totalAssets) * 100;

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-gray-900 border border-gray-700 px-3 py-2 rounded shadow-lg">
                    <p className="text-white font-bold">{data.name}</p>
                    <p className="text-gray-300 text-sm">
                        {(data.value / 10000).toFixed(1)} 萬 ({((data.value / totalAssets) * 100).toFixed(1)}%)
                    </p>
                    <p className={`text-xs ${data.isRisk ? 'text-orange-400' : 'text-cyan-400'}`}>
                        {data.isRisk ? '⚔️ 攻擊型' : '🛡️ 防守型'}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <TianJiCard title="資產配置 (Allocation)" icon={<PieChartIcon size={20} />} className="h-full border-purple-900/50">
            <div className="space-y-4">
                {/* 攻守比例條 */}
                <div className="bg-gray-800 rounded-lg p-3">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-cyan-400">🛡️ 防守 {safePercent.toFixed(0)}%</span>
                        <span className="text-orange-400">⚔️ 攻擊 {riskPercent.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex bg-gray-700">
                        <div
                            className="bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${safePercent}%` }}
                        />
                        <div
                            className="bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                            style={{ width: `${riskPercent}%` }}
                        />
                    </div>
                </div>

                {/* 圓餅圖 */}
                <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData as any}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={75}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        stroke={entry.isRisk ? '#7f1d1d' : '#1e3a5f'}
                                        strokeWidth={1}
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                formatter={(value) => <span className="text-gray-300 text-xs">{value}</span>}
                                iconSize={10}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 細分展開 */}
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {chartData.map((category) => (
                        <div key={category.name} className="bg-gray-800/50 rounded">
                            <button
                                onClick={() => setExpandedCategory(expandedCategory === category.name ? null : category.name)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                                    <span className="text-sm text-gray-200">{category.name}</span>
                                    <span className={`text-[10px] ${category.isRisk ? 'text-orange-400' : 'text-cyan-400'}`}>
                                        {category.isRisk ? '⚔️' : '🛡️'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono text-gray-300">
                                        {((category.value / totalAssets) * 100).toFixed(1)}%
                                    </span>
                                    {category.details && category.details.length > 0 && (
                                        expandedCategory === category.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </button>

                            {/* 展開的細項 */}
                            {expandedCategory === category.name && category.details && (
                                <div className="px-3 pb-2 space-y-1">
                                    {category.details.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-[11px] text-gray-400 pl-5">
                                            <span>{item.name}</span>
                                            <span className="font-mono">
                                                {(item.value / 10000).toFixed(1)}萬 ({item.percent.toFixed(1)}%)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </TianJiCard>
    );
};
