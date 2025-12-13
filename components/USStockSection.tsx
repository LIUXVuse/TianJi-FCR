import React, { useState } from 'react';
import { USStockPosition } from '../types';
import { TianJiCard } from './TianJiCard';
import { DollarSign, Trash2, Plus, Edit2, Save, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface USStockSectionProps {
    positions: USStockPosition[];
    setPositions: React.Dispatch<React.SetStateAction<USStockPosition[]>>;
    usdTwdRate: number;
}

export const USStockSection: React.FC<USStockSectionProps> = ({ positions, setPositions, usdTwdRate }) => {
    // Input state for new stock
    const [newStock, setNewStock] = useState<Partial<USStockPosition>>({
        symbol: '',
        name: '',
        costPrice: 0,
        price: 0,
        shares: 0,
    });

    // State for editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<USStockPosition>>({});

    // 計算欄位
    const calcFields = (cost: number, price: number, shares: number) => {
        const marketValue = price * shares;
        const pnl = (price - cost) * shares;
        const pnlPercent = cost > 0 ? (pnl / (cost * shares)) * 100 : 0;
        return { marketValue, pnl, pnlPercent };
    };

    const handleAddStock = () => {
        if (!newStock.symbol || !newStock.price || !newStock.shares) return;

        const cost = Number(newStock.costPrice) || Number(newStock.price);
        const price = Number(newStock.price);
        const shares = Number(newStock.shares);
        const { marketValue, pnl, pnlPercent } = calcFields(cost, price, shares);

        const stock: USStockPosition = {
            id: Date.now().toString(),
            symbol: newStock.symbol.toUpperCase(),
            name: newStock.name || newStock.symbol.toUpperCase(),
            costPrice: cost,
            price: price,
            shares: shares,
            marketValue,
            pnl,
            pnlPercent,
        };
        setPositions([...positions, stock]);
        setNewStock({ symbol: '', name: '', costPrice: 0, price: 0, shares: 0 });
    };

    const startEdit = (stock: USStockPosition) => {
        setEditingId(stock.id);
        setEditForm({ ...stock });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = () => {
        if (!editingId || !editForm.symbol) return;

        const cost = Number(editForm.costPrice) || Number(editForm.price);
        const price = Number(editForm.price);
        const shares = Number(editForm.shares);
        const { marketValue, pnl, pnlPercent } = calcFields(cost, price, shares);

        setPositions(positions.map(p =>
            p.id === editingId
                ? { ...p, ...editForm, costPrice: cost, marketValue, pnl, pnlPercent }
                : p
        ));
        cancelEdit();
    };

    const removeStock = (id: string) => {
        setPositions(positions.filter(p => p.id !== id));
    };

    // 總計
    const totalMarketValue = positions.reduce((acc, p) => acc + p.marketValue, 0);
    const totalCost = positions.reduce((acc, p) => acc + (p.costPrice * p.shares), 0);
    const totalPnL = positions.reduce((acc, p) => acc + p.pnl, 0);
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    return (
        <TianJiCard
            title="美股 (US Stock)"
            icon={<DollarSign size={20} />}
            accentColor="green"
        >
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-400">市值 (USD)</div>
                    <div className="text-lg font-bold text-white font-mono">
                        ${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-gray-500">≈ TWD {Math.round(totalMarketValue * usdTwdRate).toLocaleString()}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-400">損益 (USD)</div>
                    <div className={`text-lg font-bold font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-400">報酬率</div>
                    <div className={`text-lg font-bold font-mono ${totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Stock List */}
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {positions.map(stock => (
                    <div key={stock.id} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                        {editingId === stock.id ? (
                            // Edit Mode
                            <div className="flex-1 grid grid-cols-5 gap-2">
                                <input
                                    type="text"
                                    value={editForm.symbol || ''}
                                    onChange={e => setEditForm({ ...editForm, symbol: e.target.value.toUpperCase() })}
                                    className="bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                    placeholder="代號"
                                />
                                <input
                                    type="number"
                                    value={editForm.costPrice || 0}
                                    onChange={e => setEditForm({ ...editForm, costPrice: Number(e.target.value) })}
                                    className="bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                    placeholder="成本"
                                />
                                <input
                                    type="number"
                                    value={editForm.price || 0}
                                    onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
                                    className="bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                    placeholder="現價"
                                />
                                <input
                                    type="number"
                                    value={editForm.shares || 0}
                                    onChange={e => setEditForm({ ...editForm, shares: Number(e.target.value) })}
                                    className="bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                    placeholder="股數"
                                    step="0.01"
                                />
                                <div className="flex gap-1">
                                    <button onClick={saveEdit} className="bg-green-600 hover:bg-green-500 text-white p-1 rounded">
                                        <Save size={16} />
                                    </button>
                                    <button onClick={cancelEdit} className="bg-gray-600 hover:bg-gray-500 text-white p-1 rounded">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // View Mode
                            <>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-green-400">{stock.symbol}</span>
                                        <span className="text-xs text-gray-400">{stock.name}</span>
                                    </div>
                                    <div className="text-xs text-gray-400 flex gap-3 mt-1">
                                        <span>成本 ${stock.costPrice}</span>
                                        <span>→</span>
                                        <span>現價 ${stock.price}</span>
                                        <span>×</span>
                                        <span>{stock.shares} 股</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-mono text-sm ${stock.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stock.pnl >= 0 ? <ArrowUpRight size={14} className="inline" /> : <ArrowDownRight size={14} className="inline" />}
                                        ${Math.abs(stock.pnl).toFixed(0)} ({stock.pnlPercent.toFixed(1)}%)
                                    </div>
                                    <div className="text-xs text-gray-500">市值 ${stock.marketValue.toFixed(0)}</div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => startEdit(stock)} className="text-gray-400 hover:text-white p-1">
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => removeStock(stock.id)} className="text-gray-400 hover:text-red-400 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Add New Stock Form */}
            <div className="mt-4 bg-gray-800 rounded-lg p-3 border border-dashed border-gray-600">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Plus size={12} /> 新增美股部位
                </div>
                <div className="grid grid-cols-5 gap-2">
                    <input
                        type="text"
                        value={newStock.symbol || ''}
                        onChange={e => setNewStock({ ...newStock, symbol: e.target.value.toUpperCase() })}
                        placeholder="代號 (AAPL)"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 outline-none"
                    />
                    <input
                        type="number"
                        value={newStock.costPrice || ''}
                        onChange={e => setNewStock({ ...newStock, costPrice: Number(e.target.value) })}
                        placeholder="成本 (USD)"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 outline-none"
                    />
                    <input
                        type="number"
                        value={newStock.price || ''}
                        onChange={e => setNewStock({ ...newStock, price: Number(e.target.value) })}
                        placeholder="現價 (USD)"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 outline-none"
                    />
                    <input
                        type="number"
                        value={newStock.shares || ''}
                        onChange={e => setNewStock({ ...newStock, shares: Number(e.target.value) })}
                        placeholder="股數"
                        step="0.01"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 outline-none"
                    />
                    <button
                        onClick={handleAddStock}
                        className="bg-green-700 hover:bg-green-600 text-white text-sm rounded px-3 py-1 flex items-center justify-center gap-1 transition-colors"
                    >
                        <Plus size={14} /> 新增
                    </button>
                </div>
            </div>
        </TianJiCard>
    );
};
