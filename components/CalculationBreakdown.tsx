import React, { useState } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';

interface BreakdownData {
    // 資產
    cashTwd: number;
    stockEquityTwd: number;
    usStockEquityTwd: number;
    cryptoEquityTwd: number;
    grossAssetsTwd: number;

    // 負債
    stockLoanTwd: number;
    totalDebtTwd: number;
    totalLiabilities: number;

    // 曝險
    stockExposureTwd: number;
    usStockExposureTwd: number;
    cryptoExposureTwd: number;
    totalExposure: number;

    // 計算結果
    netWorth: number;
    realLeverage: number;
}

interface CalculationBreakdownProps {
    data: BreakdownData;
}

export const CalculationBreakdown: React.FC<CalculationBreakdownProps> = ({ data }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const formatNum = (n: number) => Math.round(n).toLocaleString();

    return (
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            {/* Header - Clickable */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-750 transition-colors"
            >
                <div className="flex items-center gap-2 text-cyan-400">
                    <Calculator size={16} />
                    <span className="font-bold text-sm">槓桿計算明細</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                        槓桿 = 曝險 ÷ 淨值 = {formatNum(data.totalExposure)} ÷ {formatNum(data.netWorth)}
                    </span>
                    <span className={`font-mono font-bold ${data.realLeverage > 2 ? 'text-red-400' : data.realLeverage > 1.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                        = {data.realLeverage.toFixed(2)}x
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 space-y-4 text-sm">
                    {/* 資產區塊 */}
                    <div>
                        <h4 className="text-green-400 font-bold mb-2 flex items-center gap-1">
                            📈 資產 (Assets)
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-400">台幣現金</span>
                                <span className="font-mono text-white">{formatNum(data.cashTwd)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">台股淨權益 (市值 - 融資)</span>
                                <span className="font-mono text-white">{formatNum(data.stockEquityTwd)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">美股淨值 (換算 TWD)</span>
                                <span className="font-mono text-white">{formatNum(data.usStockEquityTwd)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">幣圈淨值 (換算 TWD)</span>
                                <span className="font-mono text-white">{formatNum(data.cryptoEquityTwd)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-700">
                                <span className="text-green-400 font-bold">總資產</span>
                                <span className="font-mono font-bold text-green-400">{formatNum(data.grossAssetsTwd)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 負債區塊 */}
                    <div>
                        <h4 className="text-red-400 font-bold mb-2 flex items-center gap-1">
                            📉 負債 (Liabilities)
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-400">台股融資金額</span>
                                <span className="font-mono text-white">{formatNum(data.stockLoanTwd)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">信貸/房貸/車貸</span>
                                <span className="font-mono text-white">{formatNum(data.totalDebtTwd)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-700">
                                <span className="text-red-400 font-bold">總負債</span>
                                <span className="font-mono font-bold text-red-400">{formatNum(data.totalLiabilities)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 曝險區塊 */}
                    <div>
                        <h4 className="text-yellow-400 font-bold mb-2 flex items-center gap-1">
                            ⚡ 曝險 (Exposure)
                        </h4>
                        <div className="bg-gray-800 rounded-lg p-3 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-400">台股曝險 (市值)</span>
                                <span className="font-mono text-white">{formatNum(data.stockExposureTwd)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">美股曝險 (換算 TWD)</span>
                                <span className="font-mono text-white">{formatNum(data.usStockExposureTwd)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">幣圈曝險 (換算 TWD)</span>
                                <span className="font-mono text-white">{formatNum(data.cryptoExposureTwd)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-700">
                                <span className="text-yellow-400 font-bold">總曝險</span>
                                <span className="font-mono font-bold text-yellow-400">{formatNum(data.totalExposure)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 最終計算 */}
                    <div className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded-lg p-4 border border-cyan-700/50">
                        <div className="text-center">
                            <div className="text-gray-400 text-xs mb-2">最終計算</div>
                            <div className="flex items-center justify-center gap-4 text-lg">
                                <div>
                                    <div className="text-xs text-gray-400">總淨值</div>
                                    <div className="font-mono font-bold text-cyan-400">{formatNum(data.netWorth)}</div>
                                </div>
                                <div className="text-gray-500">=</div>
                                <div>
                                    <div className="text-xs text-gray-400">總資產</div>
                                    <div className="font-mono text-green-400">{formatNum(data.grossAssetsTwd)}</div>
                                </div>
                                <div className="text-gray-500">-</div>
                                <div>
                                    <div className="text-xs text-gray-400">總負債</div>
                                    <div className="font-mono text-red-400">{formatNum(data.totalLiabilities)}</div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <div className="text-xs text-gray-400 mb-1">真實槓桿倍數</div>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="font-mono text-yellow-400">{formatNum(data.totalExposure)}</span>
                                    <span className="text-gray-500">÷</span>
                                    <span className="font-mono text-cyan-400">{formatNum(data.netWorth)}</span>
                                    <span className="text-gray-500">=</span>
                                    <span className={`font-mono text-2xl font-bold ${data.realLeverage > 2 ? 'text-red-400' : data.realLeverage > 1.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                        {data.realLeverage.toFixed(2)}x
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 說明 */}
                    <div className="text-xs text-gray-500 space-y-1">
                        <p>• <span className="text-green-400">槓桿 &lt; 1x</span>：有閒置資金未投入市場</p>
                        <p>• <span className="text-yellow-400">槓桿 1-2x</span>：適度運用槓桿</p>
                        <p>• <span className="text-red-400">槓桿 &gt; 2x</span>：高風險，建議減倉</p>
                    </div>
                </div>
            )}
        </div>
    );
};
