import React, { useState } from 'react';
import { CryptoState, CryptoPosition, CryptoType } from '../types';
import { TianJiCard } from './TianJiCard';
import { Bitcoin, Plus, Trash2, Edit2, Save, X, ArrowUpRight, ArrowDownRight, Layers, Zap, Coins, RefreshCw } from 'lucide-react';
import { getPrice, POPULAR_SYMBOLS } from '../services/binanceService';

interface CryptoSectionProps {
    data: CryptoState;
    setData: React.Dispatch<React.SetStateAction<CryptoState>>;
    usdtRate: number;
}

export const CryptoSection: React.FC<CryptoSectionProps> = ({ data, setData, usdtRate }) => {

    // --- New Position State ---
    const [newPos, setNewPos] = useState({
        type: 'SPOT' as CryptoType, // Default to Spot now
        symbol: '',
        leverage: 5,   // For Future
        margin: '',    // For Future (USDT)
        units: '',     // For Spot (Coins)
        entryPrice: '',
        currentPrice: '',
        liquidationPrice: '', // 強平價 (可選，Cross Margin 需手動填)
    });

    // --- 計算爆倉距離 % ---
    const calculateLiqDistance = (pos: CryptoPosition): number | null => {
        if (pos.type === 'SPOT') return null; // 現貨無爆倉

        const current = pos.currentPrice;
        if (current <= 0) return null;

        // 優先使用用戶輸入的強平價
        if (pos.liquidationPrice && pos.liquidationPrice > 0) {
            return ((current - pos.liquidationPrice) / current) * 100;
        }

        // 若無強平價，使用預估公式: Entry * (1 - 1/Leverage)
        const entry = pos.entryPrice;
        const lev = pos.leverage;
        if (entry <= 0 || lev <= 1) return null;

        const estLiqPrice = entry * (1 - 1 / lev);
        return ((current - estLiqPrice) / current) * 100;
    };

    // --- Editing State ---
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CryptoPosition> & { marginStr?: string, unitsStr?: string, entryStr?: string, currentStr?: string }>({});

    // --- Price Loading State ---
    const [isLoadingPrice, setIsLoadingPrice] = useState(false);
    const [isUpdatingAll, setIsUpdatingAll] = useState(false);

    // --- PnL Calculation Core ---
    const calculateStats = (type: CryptoType, amount: number, leverage: number, entry: number, current: number) => {
        // amount: 若是 Spot 代表 units (顆數), 若是 Future 代表 margin (本金)

        if (entry === 0 && current === 0) return { pnl: 0, pnlPercent: 0, size: 0 };

        let pnl = 0;
        let pnlPercent = 0;
        let size = 0;

        if (type === 'SPOT') {
            const units = amount;
            // Spot PnL = (Current - Entry) * Units
            pnl = (current - entry) * units;

            // Spot Size = Units * Current Price (市值)
            size = units * current;

            // Spot PnL %
            const costBasis = units * entry;
            pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        } else {
            const margin = amount;
            // Future PnL = Margin * Leverage * ( (Current - Entry) / Entry )
            // Long logic only for simplicity now. (Shorting needs direction flag, assuming Long)
            const rawPercent = entry > 0 ? (current - entry) / entry : 0;
            pnlPercent = rawPercent * leverage * 100;
            pnl = margin * (pnlPercent / 100);

            // Future Size = Margin * Leverage
            size = margin * leverage;
        }

        return { pnl, pnlPercent, size };
    };

    // --- Fetch Live Price from Binance ---
    const fetchLivePrice = async () => {
        if (!newPos.symbol) return;
        setIsLoadingPrice(true);
        try {
            const price = await getPrice(newPos.symbol);
            if (price !== null) {
                setNewPos(prev => ({ ...prev, currentPrice: price.toString() }));
            } else {
                alert(`找不到 ${newPos.symbol.toUpperCase()}USDT 的價格`);
            }
        } catch (error) {
            console.error('取得價格失敗:', error);
        } finally {
            setIsLoadingPrice(false);
        }
    };

    // --- Add Logic ---
    const addPosition = () => {
        if (!newPos.symbol || !newPos.entryPrice || !newPos.currentPrice) return;

        // Validation
        if (newPos.type === 'FUTURE' && !newPos.margin) return;
        if (newPos.type === 'SPOT' && !newPos.units) return;

        const type = newPos.type;
        const entry = Number(newPos.entryPrice);
        const current = Number(newPos.currentPrice);
        const leverage = type === 'SPOT' ? 1 : Number(newPos.leverage);

        // Determine "Amount" based on type
        const amount = type === 'SPOT' ? Number(newPos.units) : Number(newPos.margin);

        const { pnl, pnlPercent, size } = calculateStats(type, amount, leverage, entry, current);

        const pos: CryptoPosition = {
            id: Date.now().toString(),
            type: type,
            symbol: newPos.symbol.toUpperCase(),
            leverage,
            entryPrice: entry,
            currentPrice: current,
            margin: type === 'FUTURE' ? amount : 0, // Store margin only for Future
            units: type === 'SPOT' ? amount : 0,    // Store units only for Spot
            liquidationPrice: type === 'FUTURE' && newPos.liquidationPrice ? Number(newPos.liquidationPrice) : undefined,
            positionSize: size,
            pnl,
            pnlPercent
        };

        setData(prev => ({
            ...prev,
            positions: [...(prev.positions || []), pos]
        }));

        setNewPos({ ...newPos, symbol: '', margin: '', units: '', entryPrice: '', currentPrice: '', liquidationPrice: '' });
    };

    // --- Edit Logic ---
    const startEdit = (pos: CryptoPosition) => {
        setEditingId(pos.id);
        setEditForm({
            ...pos,
            marginStr: pos.margin?.toString() || '',
            unitsStr: pos.units?.toString() || '',
            entryStr: pos.entryPrice.toString(),
            currentStr: pos.currentPrice.toString()
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = () => {
        if (!editingId || !editForm.symbol) return;

        const type = editForm.type || 'SPOT';
        const entry = Number(editForm.entryStr);
        const current = Number(editForm.currentStr);
        const leverage = type === 'SPOT' ? 1 : Number(editForm.leverage);

        const amount = type === 'SPOT' ? Number(editForm.unitsStr) : Number(editForm.marginStr);

        const { pnl, pnlPercent, size } = calculateStats(type, amount, leverage, entry, current);

        const updatedPositions = (data.positions || []).map(p => {
            if (p.id === editingId) {
                return {
                    ...p,
                    type,
                    symbol: editForm.symbol!,
                    leverage,
                    margin: type === 'FUTURE' ? amount : 0,
                    units: type === 'SPOT' ? amount : 0,
                    entryPrice: entry,
                    currentPrice: current,
                    positionSize: size,
                    pnl,
                    pnlPercent
                };
            }
            return p;
        });

        setData(prev => ({ ...prev, positions: updatedPositions }));
        setEditingId(null);
        setEditForm({});
    };

    // --- Remove Logic ---
    const removePosition = (id: string) => {
        setData(prev => ({
            ...prev,
            positions: prev.positions.filter(p => p.id !== id)
        }));
    };

    const handleBalanceChange = (val: string) => {
        setData(prev => ({ ...prev, walletBalance: Number(val) }));
    };

    // --- Refresh All Positions' Current Prices ---
    const refreshAllPrices = async () => {
        const positions = data.positions || [];
        if (positions.length === 0) return;

        setIsUpdatingAll(true);
        try {
            // Get unique symbols
            const symbols = Array.from(new Set<string>(positions.map(p => p.symbol.toUpperCase().replace('/USDT', '').replace('USDT', ''))));

            // Fetch all prices
            const priceMap: Record<string, number> = {};
            await Promise.all(
                symbols.map(async (symbol) => {
                    const price = await getPrice(symbol);
                    if (price !== null) {
                        priceMap[symbol] = price;
                    }
                })
            );

            // Update all positions with new prices
            const updatedPositions = positions.map(p => {
                const normalizedSymbol = p.symbol.toUpperCase().replace('/USDT', '').replace('USDT', '');
                const newPrice = priceMap[normalizedSymbol];

                if (newPrice !== undefined) {
                    const amount = p.type === 'SPOT' ? p.units : p.margin;
                    const { pnl, pnlPercent, size } = calculateStats(
                        p.type, amount, p.leverage, p.entryPrice, newPrice
                    );

                    return {
                        ...p,
                        currentPrice: newPrice,
                        positionSize: size,
                        pnl,
                        pnlPercent
                    };
                }
                return p;
            });

            setData(prev => ({ ...prev, positions: updatedPositions }));
        } catch (error) {
            console.error('批次更新價格失敗:', error);
        } finally {
            setIsUpdatingAll(false);
        }
    };

    // Aggregates for Footer (Need to handle Spot Cost Basis vs Future Margin)
    const totalCostBasis = (data.positions || []).reduce((acc, p) => {
        if (p.type === 'SPOT') return acc + (p.units * p.entryPrice);
        return acc + p.margin;
    }, 0);

    const totalPnL = (data.positions || []).reduce((acc, p) => acc + p.pnl, 0);
    const totalPositionSize = (data.positions || []).reduce((acc, p) => acc + p.positionSize, 0);
    const totalCryptoEquityTwd = (data.walletBalance + totalCostBasis + totalPnL) * usdtRate;

    // Preview Calculation for New Form
    const previewAmount = newPos.type === 'SPOT' ? Number(newPos.units) : Number(newPos.margin);
    const previewLeverage = newPos.type === 'SPOT' ? 1 : Number(newPos.leverage);
    const previewCalc = calculateStats(
        newPos.type,
        previewAmount,
        previewLeverage,
        Number(newPos.entryPrice),
        Number(newPos.currentPrice)
    );

    return (
        <TianJiCard title="加密貨幣 (USDT -> TWD)" icon={<Bitcoin size={20} />} className="h-full border-cyan-900/50">
            <div className="space-y-4">

                {/* 1. Global Wallet Balance (Free Cash) */}
                <div className="bg-gray-800 p-3 rounded border border-gray-700">
                    <label className="text-xs text-gray-400 block mb-1">可用現貨餘額 (Uninvested USDT)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={data.walletBalance || ''}
                            onChange={(e) => handleBalanceChange(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white font-mono focus:border-cyan-500 outline-none pl-8"
                            placeholder="0.00"
                        />
                        <span className="absolute left-2 top-2 text-gray-500">$</span>
                    </div>
                </div>

                {/* Refresh All Prices Button */}
                {(data.positions || []).length > 0 && (
                    <button
                        onClick={refreshAllPrices}
                        disabled={isUpdatingAll}
                        className="w-full bg-gradient-to-r from-emerald-700 to-cyan-700 hover:from-emerald-600 hover:to-cyan-600 disabled:from-gray-700 disabled:to-gray-700 text-white text-sm py-2 rounded flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                        <RefreshCw size={16} className={isUpdatingAll ? 'animate-spin' : ''} />
                        {isUpdatingAll ? '更新中...' : `⚙️ 一鍵更新全部現價 (${(data.positions || []).length} 個部位)`}
                    </button>
                )}

                {/* 2. Add New Position Form */}
                <div className="bg-gray-800/50 p-3 rounded border border-gray-700 space-y-2">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-bold text-cyan-400 flex items-center gap-2"><Plus size={12} /> 新增部位</div>
                        <div className="flex bg-gray-900 rounded p-1 border border-gray-600">
                            <button
                                onClick={() => setNewPos({ ...newPos, type: 'SPOT' })}
                                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${newPos.type === 'SPOT' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                現貨 Spot
                            </button>
                            <button
                                onClick={() => setNewPos({ ...newPos, type: 'FUTURE' })}
                                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${newPos.type === 'FUTURE' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                合約 Future
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex gap-1">
                            <input
                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white flex-1"
                                placeholder="幣種 (BTC/ETH/SOL)"
                                value={newPos.symbol}
                                onChange={e => setNewPos({ ...newPos, symbol: e.target.value.toUpperCase() })}
                                list="popular-symbols"
                            />
                            <datalist id="popular-symbols">
                                {POPULAR_SYMBOLS.map(s => <option key={s} value={s} />)}
                            </datalist>
                            <button
                                onClick={fetchLivePrice}
                                disabled={isLoadingPrice || !newPos.symbol}
                                className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs px-2 rounded flex items-center gap-1 transition-colors"
                                title="從幣安取得即時價格"
                            >
                                <RefreshCw size={12} className={isLoadingPrice ? 'animate-spin' : ''} />
                                {isLoadingPrice ? '' : '即時'}
                            </button>
                        </div>
                        {newPos.type === 'FUTURE' ? (
                            <div className="flex items-center gap-1">
                                <span className="text-gray-400 text-xs">x</span>
                                <input
                                    type="number"
                                    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white w-full"
                                    placeholder="槓桿"
                                    value={newPos.leverage}
                                    onChange={e => setNewPos({ ...newPos, leverage: Number(e.target.value) })}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center bg-gray-900/50 rounded border border-gray-700">
                                <span className="text-xs text-gray-500">1x (實持)</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {newPos.type === 'SPOT' ? (
                            <input
                                type="number"
                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                                placeholder="顆數/單位"
                                value={newPos.units}
                                onChange={e => setNewPos({ ...newPos, units: e.target.value })}
                            />
                        ) : (
                            <input
                                type="number"
                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                                placeholder="保證金(U)"
                                value={newPos.margin}
                                onChange={e => setNewPos({ ...newPos, margin: e.target.value })}
                            />
                        )}

                        <input
                            type="number"
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                            placeholder="均價"
                            value={newPos.entryPrice}
                            onChange={e => setNewPos({ ...newPos, entryPrice: e.target.value })}
                        />
                        <input
                            type="number"
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                            placeholder="現價"
                            value={newPos.currentPrice}
                            onChange={e => setNewPos({ ...newPos, currentPrice: e.target.value })}
                        />
                    </div>

                    {/* 強平價輸入 (只在合約時顯示) */}
                    {newPos.type === 'FUTURE' && (
                        <div>
                            <input
                                type="number"
                                className="w-full bg-gray-900 border border-orange-600/50 rounded px-2 py-1 text-sm text-orange-300 placeholder-orange-300/50"
                                placeholder="強平價 (可選，Cross Margin 建議填寫)"
                                value={newPos.liquidationPrice}
                                onChange={e => setNewPos({ ...newPos, liquidationPrice: e.target.value })}
                            />
                        </div>
                    )}

                    {/* Live Preview */}
                    {((newPos.margin || newPos.units) && newPos.entryPrice) && (
                        <div className="flex justify-between text-[10px] px-1 bg-gray-900/50 p-1 rounded">
                            <span className="text-gray-400">市值: ${Math.round(previewCalc.size)}</span>
                            <span className={`${previewCalc.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                預估: {previewCalc.pnl > 0 ? '+' : ''}{Math.round(previewCalc.pnl)} U ({previewCalc.pnlPercent.toFixed(2)}%)
                            </span>
                        </div>
                    )}

                    <button
                        onClick={addPosition}
                        className={`w-full text-white text-sm py-1.5 rounded border transition-colors flex justify-center items-center gap-1 shadow-lg ${newPos.type === 'SPOT' ? 'bg-cyan-900 hover:bg-cyan-800 border-cyan-700' : 'bg-purple-900 hover:bg-purple-800 border-purple-700'}`}
                    >
                        確認{newPos.type === 'SPOT' ? '現貨入庫' : '合約開倉'}
                    </button>
                </div>

                {/* 3. Positions List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {(data.positions || []).map(p => {
                        const isEditing = editingId === p.id;

                        if (isEditing) {
                            return (
                                <div key={p.id} className="bg-gray-800 p-2 rounded border border-cyan-500 space-y-2">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs font-bold text-cyan-400">編輯 {p.type === 'SPOT' ? '現貨' : '合約'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            className="bg-gray-900 w-20 px-2 py-1 rounded text-sm text-white"
                                            value={editForm.symbol}
                                            onChange={e => setEditForm({ ...editForm, symbol: e.target.value })}
                                        />
                                        {p.type === 'FUTURE' && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-gray-500">x</span>
                                                <input
                                                    type="number"
                                                    className="bg-gray-900 w-12 px-2 py-1 rounded text-sm text-white"
                                                    value={editForm.leverage}
                                                    onChange={e => setEditForm({ ...editForm, leverage: Number(e.target.value) })}
                                                />
                                            </div>
                                        )}
                                        <input
                                            type="number"
                                            className="bg-gray-900 flex-1 px-2 py-1 rounded text-sm text-white"
                                            placeholder={p.type === 'SPOT' ? "顆數" : "保證金"}
                                            value={p.type === 'SPOT' ? editForm.unitsStr : editForm.marginStr}
                                            onChange={e => p.type === 'SPOT' ? setEditForm({ ...editForm, unitsStr: e.target.value }) : setEditForm({ ...editForm, marginStr: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            className="bg-gray-900 w-1/2 px-2 py-1 rounded text-sm text-white"
                                            placeholder="均價"
                                            value={editForm.entryStr}
                                            onChange={e => setEditForm({ ...editForm, entryStr: e.target.value })}
                                        />
                                        <input
                                            type="number"
                                            className="bg-gray-900 w-1/2 px-2 py-1 rounded text-sm text-white"
                                            placeholder="現價"
                                            value={editForm.currentStr}
                                            onChange={e => setEditForm({ ...editForm, currentStr: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={saveEdit} className="p-1 bg-green-700 rounded hover:bg-green-600"><Save size={16} /></button>
                                        <button onClick={cancelEdit} className="p-1 bg-gray-600 rounded hover:bg-gray-500"><X size={16} /></button>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={p.id} className={`bg-gray-800 p-2 rounded border-l-2 relative group hover:bg-gray-750 transition-colors ${p.type === 'SPOT' ? 'border-l-cyan-500' : 'border-l-purple-500'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-white text-sm flex items-center gap-2">
                                        {p.symbol}
                                        {p.type === 'SPOT' ? (
                                            <span className="text-[10px] bg-cyan-900/50 text-cyan-200 px-1 rounded flex items-center gap-1"><Layers size={8} />現貨</span>
                                        ) : (
                                            <span className="text-[10px] bg-purple-900/50 text-purple-200 px-1 rounded flex items-center gap-1"><Zap size={8} />{p.leverage}x</span>
                                        )}
                                    </span>
                                    <div className="text-right flex items-center gap-1">
                                        <span className={`text-[10px] ${p.pnl >= 0 ? 'text-gray-400' : 'text-gray-400'}`}>
                                            {p.pnl >= 0 ? <ArrowUpRight size={12} className="inline text-emerald-500" /> : <ArrowDownRight size={12} className="inline text-red-500" />}
                                        </span>
                                        <div className={`font-mono text-sm font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {p.pnl > 0 ? '+' : ''}{p.pnl.toFixed(1)} U
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    {/* Display Logic for Spot vs Future */}
                                    {p.type === 'SPOT' ? (
                                        <span><Coins size={10} className="inline mr-1" />{p.units} 顆 | {p.entryPrice} → {p.currentPrice}</span>
                                    ) : (
                                        <span>本: {p.margin} | {p.entryPrice} → {p.currentPrice}</span>
                                    )}

                                    <div className="flex items-center gap-2">
                                        {/* 爆倉距離 (僅合約顯示) */}
                                        {p.type === 'FUTURE' && (() => {
                                            const liqDist = calculateLiqDistance(p);
                                            if (liqDist === null) return null;
                                            const isEstimate = !p.liquidationPrice || p.liquidationPrice <= 0;
                                            const isDanger = liqDist < 10;
                                            return (
                                                <span
                                                    className={`font-mono ${isDanger ? 'text-red-500 font-bold animate-pulse' : 'text-orange-400'}`}
                                                    title={isEstimate ? '預估強平距離 (建議輸入實際強平價)' : '基於輸入的強平價計算'}
                                                >
                                                    {liqDist > 0 ? '-' : ''}{Math.abs(liqDist).toFixed(1)}% Liq{isEstimate ? '*' : ''}
                                                </span>
                                            );
                                        })()}
                                        <span className={`${p.pnlPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {p.pnlPercent.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="absolute right-1 top-1 hidden group-hover:flex gap-1 bg-gray-800 shadow-md rounded p-1">
                                    <button onClick={() => startEdit(p)} className="text-cyan-500 hover:text-cyan-300">
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => removePosition(p.id)} className="text-gray-500 hover:text-red-400">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Summary Footer */}
                <div className="pt-4 border-t border-gray-700">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400">Crypto 淨值 (TWD)</span>
                        <span className="text-sm font-bold text-emerald-400">{Math.round(totalCryptoEquityTwd).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Crypto 總曝險 (TWD)</span>
                        <span className="text-sm font-bold text-red-400">{Math.round(totalPositionSize * usdtRate).toLocaleString()}</span>
                    </div>
                </div>

            </div>
        </TianJiCard>
    );
};
