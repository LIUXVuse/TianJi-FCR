import React, { useState } from 'react';
import { StockPosition } from '../types';
import { TianJiCard } from './TianJiCard';
import { TrendingUp, Trash2, Plus, Edit2, Save, X, ArrowUpRight, ArrowDownRight, Zap, RefreshCw } from 'lucide-react';
import { extractStockCode, getStockPrice, getPriceStatus } from '../services/twseService';

interface StockSectionProps {
  positions: StockPosition[];
  setPositions: React.Dispatch<React.SetStateAction<StockPosition[]>>;
}

export const StockSection: React.FC<StockSectionProps> = ({ positions, setPositions }) => {
  // Input state for new stock
  const [newStock, setNewStock] = useState<Partial<StockPosition>>({
    name: '',
    costPrice: 0,
    price: 0,
    shares: 0,
    pledgeRate: 0,
    isMargin: false,
  });

  // State for editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockPosition>>({});

  // State for price updating
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [priceStatus, setPriceStatus] = useState(getPriceStatus());

  // 計算借貸金額邏輯
  const calculateLoan = (cost: number, price: number, shares: number, rate: number, isMargin: boolean) => {
    if (isMargin) {
      // 台股融資邏輯：自備 4 成，融資 6 成 (槓桿 2.5倍)
      // 借款金額通常是鎖定在「買進成本」的 6 成
      return Math.round(cost * shares * 0.6);
    } else {
      // 一般質押：看現價打折
      return Math.round(price * shares * (rate / 100));
    }
  };

  // 計算融資風險指標 (維持率 & 斷頭距離)
  const calculateMarginRisk = (stock: StockPosition): { maintenanceRate: number; distanceToKill: number } | null => {
    if (!stock.isMargin || stock.loanAmount <= 0) return null;

    const marketValue = stock.price * stock.shares;
    const loanAmount = stock.loanAmount;

    // 維持率 = 現值 / 融資金額 × 100%
    const maintenanceRate = (marketValue / loanAmount) * 100;

    // 斷頭價 = 融資金額 × 130% / 股數
    const killPrice = (loanAmount * 1.30) / stock.shares;

    // 距離斷頭 % = (現價 - 斷頭價) / 現價 × 100%
    const distanceToKill = ((stock.price - killPrice) / stock.price) * 100;

    return { maintenanceRate, distanceToKill };
  };

  const handleAddStock = () => {
    if (!newStock.name || !newStock.price || !newStock.shares) return;

    const cost = Number(newStock.costPrice) || Number(newStock.price);
    const current = Number(newStock.price);
    const shares = Number(newStock.shares);
    const rate = Number(newStock.pledgeRate || 0);
    const isMargin = !!newStock.isMargin;

    const loan = calculateLoan(cost, current, shares, rate, isMargin);

    const stock: StockPosition = {
      id: Date.now().toString(),
      name: newStock.name,
      costPrice: cost,
      price: current,
      shares: shares,
      pledgeRate: rate,
      isMargin: isMargin,
      loanAmount: loan,
    };
    setPositions([...positions, stock]);
    setNewStock({ name: '', costPrice: 0, price: 0, shares: 0, pledgeRate: 0, isMargin: false });
  };

  const startEdit = (stock: StockPosition) => {
    setEditingId(stock.id);
    setEditForm({ ...stock });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingId || !editForm.name) return;

    const updatedPositions = positions.map(p => {
      if (p.id === editingId) {
        const cost = Number(editForm.costPrice || 0);
        const price = Number(editForm.price || 0);
        const shares = Number(editForm.shares || 0);
        const rate = Number(editForm.pledgeRate || 0);
        const isMargin = !!editForm.isMargin;

        const loan = calculateLoan(cost, price, shares, rate, isMargin);

        return {
          ...p,
          name: editForm.name!,
          costPrice: cost,
          price,
          shares,
          pledgeRate: rate,
          isMargin: isMargin,
          loanAmount: loan
        };
      }
      return p;
    });

    setPositions(updatedPositions);
    setEditingId(null);
    setEditForm({});
  };

  const removeStock = (id: string) => {
    setPositions(positions.filter(p => p.id !== id));
  };

  // --- Refresh All Stock Prices ---
  const refreshAllPrices = async () => {
    if (positions.length === 0) return;

    setIsUpdatingAll(true);
    setPriceStatus(getPriceStatus());

    try {
      const updatedPositions = await Promise.all(
        positions.map(async (stock) => {
          // 從名稱中提取股票代號
          const stockCode = extractStockCode(stock.name);
          if (!stockCode) {
            console.warn(`無法從 "${stock.name}" 提取股票代號`);
            return stock;
          }

          const priceData = await getStockPrice(stockCode);
          if (priceData) {
            const newLoan = calculateLoan(
              stock.costPrice, priceData.price, stock.shares,
              stock.pledgeRate, stock.isMargin
            );

            return {
              ...stock,
              price: priceData.price,
              loanAmount: newLoan
            };
          }
          return stock;
        })
      );

      setPositions(updatedPositions);
    } catch (error) {
      console.error('批次更新股價失敗:', error);
    } finally {
      setIsUpdatingAll(false);
    }
  };

  // Helper calculation for display
  const totalMarketValue = positions.reduce((acc, p) => acc + (p.price * p.shares), 0);
  const totalCostValue = positions.reduce((acc, p) => acc + (p.costPrice * p.shares), 0);
  const totalLoan = positions.reduce((acc, p) => acc + p.loanAmount, 0);

  // PnL Stats
  const totalPnL = totalMarketValue - totalCostValue;
  const totalPnLPercent = totalCostValue > 0 ? (totalPnL / totalCostValue) * 100 : 0;

  return (
    <TianJiCard title="台股部位 (TWD)" icon={<TrendingUp size={20} />} className="h-full">
      <div className="space-y-4">
        {/* Input Form */}
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">股票名稱</label>
              <input
                type="text"
                placeholder="台積電"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-cyan-500 outline-none"
                value={newStock.name}
                onChange={e => setNewStock({ ...newStock, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">股數 (Shares)</label>
              <input
                type="number"
                placeholder="1000 (=1張)"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-cyan-500 outline-none"
                value={newStock.shares || ''}
                onChange={e => setNewStock({ ...newStock, shares: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">成本價 (Cost)</label>
              <input
                type="number"
                placeholder="買入價"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-cyan-500 outline-none"
                value={newStock.costPrice || ''}
                onChange={e => setNewStock({ ...newStock, costPrice: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">現價 (Current)</label>
              <input
                type="number"
                placeholder="現在價"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-cyan-500 outline-none"
                value={newStock.price || ''}
                onChange={e => setNewStock({ ...newStock, price: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col justify-end">
              {/* Margin Toggle */}
              <label className="flex items-center gap-2 cursor-pointer bg-gray-900 border border-gray-600 rounded px-2 py-1.5 h-full">
                <input
                  type="checkbox"
                  checked={newStock.isMargin || false}
                  onChange={e => setNewStock({ ...newStock, isMargin: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500"
                />
                <span className={`text-xs ${newStock.isMargin ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                  {newStock.isMargin ? '融資買進 (2.5x)' : '現股/質押'}
                </span>
              </label>
            </div>
          </div>

          {/* Conditional Pledge Input (Only if not Margin) */}
          {!newStock.isMargin && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">質押率 % (若無則填0)</label>
              <input
                type="number"
                placeholder="0"
                max="100"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:border-cyan-500 outline-none"
                value={newStock.pledgeRate || ''}
                onChange={e => setNewStock({ ...newStock, pledgeRate: Number(e.target.value) })}
              />
            </div>
          )}

          <button
            onClick={handleAddStock}
            className="w-full bg-cyan-700 hover:bg-cyan-600 text-white text-sm py-2 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={16} /> 加入觀察名單
          </button>
        </div>

        {/* Refresh All Prices Button */}
        {positions.length > 0 && (
          <button
            onClick={refreshAllPrices}
            disabled={isUpdatingAll}
            className="w-full bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-700 text-white text-sm py-2 rounded flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            <RefreshCw size={16} className={isUpdatingAll ? 'animate-spin' : ''} />
            {isUpdatingAll ? '更新中...' : `⚙️ 一鍵更新全部現價 (${positions.length} 檔)`}
            <span className="text-xs opacity-70 ml-1">{priceStatus}</span>
          </button>
        )}

        {/* List */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {positions.map(stock => {
            const isEditing = editingId === stock.id;
            const marketVal = stock.price * stock.shares;
            const costVal = stock.costPrice * stock.shares;
            const pnl = marketVal - costVal;
            const pnlPercent = costVal > 0 ? (pnl / costVal) * 100 : 0;

            if (isEditing) {
              return (
                <div key={stock.id} className="bg-gray-800 p-3 rounded border border-cyan-600 space-y-2">
                  <div className="flex gap-2 items-center mb-2">
                    <span className="text-xs text-cyan-400 font-bold">編輯中...</span>
                    <label className="flex items-center gap-2 cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={editForm.isMargin || false}
                        onChange={e => setEditForm({ ...editForm, isMargin: e.target.checked })}
                        className="w-3 h-3 accent-red-500"
                      />
                      <span className={`text-xs ${editForm.isMargin ? 'text-red-400' : 'text-gray-400'}`}>融資</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="bg-gray-900 px-2 py-1 rounded text-sm text-white"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <input
                      type="number"
                      className="bg-gray-900 px-2 py-1 rounded text-sm text-white"
                      value={editForm.shares}
                      onChange={e => setEditForm({ ...editForm, shares: Number(e.target.value) })}
                      placeholder="股數"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="bg-gray-900 px-2 py-1 rounded text-sm text-white"
                      value={editForm.costPrice}
                      onChange={e => setEditForm({ ...editForm, costPrice: Number(e.target.value) })}
                      placeholder="成本"
                    />
                    <input
                      type="number"
                      className="bg-gray-900 px-2 py-1 rounded text-sm text-white"
                      value={editForm.price}
                      onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
                      placeholder="現價"
                    />
                  </div>
                  {!editForm.isMargin && (
                    <input
                      type="number"
                      className="bg-gray-900 w-full px-2 py-1 rounded text-sm text-white"
                      value={editForm.pledgeRate}
                      onChange={e => setEditForm({ ...editForm, pledgeRate: Number(e.target.value) })}
                      placeholder="質押%"
                    />
                  )}
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={saveEdit} className="p-1 bg-green-700 rounded hover:bg-green-600"><Save size={16} /></button>
                    <button onClick={cancelEdit} className="p-1 bg-gray-600 rounded hover:bg-gray-500"><X size={16} /></button>
                  </div>
                </div>
              )
            }

            return (
              <div key={stock.id} className={`flex justify-between items-center bg-gray-700/50 p-3 rounded border ${stock.isMargin ? 'border-red-900/50' : 'border-gray-600'} group hover:border-gray-500 transition-colors`}>
                <div>
                  <div className="font-bold text-gray-200 flex items-center gap-2">
                    {stock.name}
                    {stock.isMargin ? (
                      <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <Zap size={8} fill="currentColor" /> 融資
                      </span>
                    ) : (
                      stock.pledgeRate > 0 && <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1 rounded border border-blue-800">質 {stock.pledgeRate}%</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {stock.shares.toLocaleString()} 股
                    <span className="mx-1">|</span>
                    成本: {stock.costPrice}
                    <span className="mx-1">→</span>
                    現價: <span className="text-gray-200">{stock.price}</span>
                  </div>
                  {/* 融資風險指標 */}
                  {(() => {
                    const risk = calculateMarginRisk(stock);
                    if (!risk) return null;
                    const isDanger = risk.maintenanceRate < 140 || risk.distanceToKill < 10;
                    return (
                      <div className={`text-[10px] mt-1 font-mono ${isDanger ? 'text-red-500 font-bold' : 'text-orange-400'}`}>
                        維持率: {risk.maintenanceRate.toFixed(0)}% | 距斷頭: {risk.distanceToKill > 0 ? '-' : ''}{Math.abs(risk.distanceToKill).toFixed(1)}%
                      </div>
                    );
                  })()}
                </div>
                <div className="text-right flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <div className="text-gray-200 font-mono font-bold text-sm">{marketVal.toLocaleString()}</div>
                    <div className={`text-xs font-mono flex items-center gap-1 ${pnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {pnl >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {pnl > 0 ? '+' : ''}{pnl.toLocaleString()} ({pnlPercent.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(stock)} className="text-cyan-500 hover:text-cyan-400">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => removeStock(stock.id)} className="text-gray-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {positions.length === 0 && <p className="text-center text-gray-500 text-sm py-4">施主目前空手，心無雜念。</p>}
        </div>

        {/* Mini Stats Footer */}
        {positions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-400">台股總損益</div>
              <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {totalPnL > 0 ? '+' : ''}{totalPnL.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">總負債 (融資+質押)</div>
              <div className="text-lg font-bold text-red-400">{totalLoan.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </TianJiCard>
  );
};
