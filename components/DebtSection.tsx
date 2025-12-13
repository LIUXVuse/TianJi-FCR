import React, { useState } from 'react';
import { DebtItem } from '../types';
import { TianJiCard } from './TianJiCard';
import { CreditCard, Trash2, Plus, Edit2, Save, X, Home, Car, Wallet } from 'lucide-react';

interface DebtSectionProps {
    debts: DebtItem[];
    setDebts: React.Dispatch<React.SetStateAction<DebtItem[]>>;
}

const DEBT_TYPE_INFO = {
    credit: { label: '信用貸款', icon: CreditCard, color: 'text-red-400' },
    mortgage: { label: '房屋貸款', icon: Home, color: 'text-blue-400' },
    car: { label: '車貸', icon: Car, color: 'text-yellow-400' },
    other: { label: '其他負債', icon: Wallet, color: 'text-gray-400' },
};

export const DebtSection: React.FC<DebtSectionProps> = ({ debts, setDebts }) => {
    const [newDebt, setNewDebt] = useState<Partial<DebtItem>>({
        type: 'credit',
        name: '',
        principalAmount: 0,
        outstandingAmount: 0,
        monthlyPayment: 0,
        interestRate: 0,
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<DebtItem>>({});

    const handleAddDebt = () => {
        if (!newDebt.name || !newDebt.outstandingAmount) return;

        const debt: DebtItem = {
            id: Date.now().toString(),
            type: newDebt.type as DebtItem['type'] || 'other',
            name: newDebt.name,
            principalAmount: Number(newDebt.principalAmount) || Number(newDebt.outstandingAmount),
            outstandingAmount: Number(newDebt.outstandingAmount),
            monthlyPayment: Number(newDebt.monthlyPayment) || 0,
            interestRate: Number(newDebt.interestRate) || 0,
        };
        setDebts([...debts, debt]);
        setNewDebt({
            type: 'credit',
            name: '',
            principalAmount: 0,
            outstandingAmount: 0,
            monthlyPayment: 0,
            interestRate: 0,
        });
    };

    const startEdit = (debt: DebtItem) => {
        setEditingId(debt.id);
        setEditForm({ ...debt });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = () => {
        if (!editingId) return;
        setDebts(debts.map(d =>
            d.id === editingId ? { ...d, ...editForm } as DebtItem : d
        ));
        cancelEdit();
    };

    const removeDebt = (id: string) => {
        setDebts(debts.filter(d => d.id !== id));
    };

    // 總計
    const totalDebt = debts.reduce((acc, d) => acc + d.outstandingAmount, 0);
    const totalMonthlyPayment = debts.reduce((acc, d) => acc + d.monthlyPayment, 0);

    return (
        <TianJiCard
            title="負債 (Debts)"
            icon={<CreditCard size={20} />}
            accentColor="red"
        >
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-400">總負債</div>
                    <div className="text-xl font-bold text-red-400 font-mono">
                        {totalDebt.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">TWD</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-400">每月還款</div>
                    <div className="text-xl font-bold text-orange-400 font-mono">
                        {totalMonthlyPayment.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">TWD / 月</div>
                </div>
            </div>

            {/* Debt List */}
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {debts.map(debt => {
                    const typeInfo = DEBT_TYPE_INFO[debt.type];
                    const TypeIcon = typeInfo.icon;

                    return (
                        <div key={debt.id} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                            {editingId === debt.id ? (
                                // Edit Mode
                                <div className="flex-1 grid grid-cols-4 gap-2">
                                    <select
                                        value={editForm.type || 'credit'}
                                        onChange={e => setEditForm({ ...editForm, type: e.target.value as DebtItem['type'] })}
                                        className="bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                    >
                                        <option value="credit">信貸</option>
                                        <option value="mortgage">房貸</option>
                                        <option value="car">車貸</option>
                                        <option value="other">其他</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                        placeholder="名稱"
                                    />
                                    <input
                                        type="number"
                                        value={editForm.outstandingAmount || 0}
                                        onChange={e => setEditForm({ ...editForm, outstandingAmount: Number(e.target.value) })}
                                        className="bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                        placeholder="尚欠金額"
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
                                    <TypeIcon size={20} className={typeInfo.color} />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white">{debt.name}</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${typeInfo.color} bg-gray-700`}>
                                                {typeInfo.label}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            {debt.interestRate > 0 && <span>年利率 {debt.interestRate}% · </span>}
                                            {debt.monthlyPayment > 0 && <span>月繳 ${debt.monthlyPayment.toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono text-red-400 font-bold">
                                            ${debt.outstandingAmount.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => startEdit(debt)} className="text-gray-400 hover:text-white p-1">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => removeDebt(debt.id)} className="text-gray-400 hover:text-red-400 p-1">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}

                {debts.length === 0 && (
                    <div className="text-center text-gray-500 py-4 text-sm">
                        🎉 太棒了！目前沒有負債
                    </div>
                )}
            </div>

            {/* Add New Debt Form */}
            <div className="mt-4 bg-gray-800 rounded-lg p-3 border border-dashed border-gray-600">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Plus size={12} /> 新增負債
                </div>
                <div className="grid grid-cols-5 gap-2">
                    <select
                        value={newDebt.type || 'credit'}
                        onChange={e => setNewDebt({ ...newDebt, type: e.target.value as DebtItem['type'] })}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-red-500 outline-none"
                    >
                        <option value="credit">信貸</option>
                        <option value="mortgage">房貸</option>
                        <option value="car">車貸</option>
                        <option value="other">其他</option>
                    </select>
                    <input
                        type="text"
                        value={newDebt.name || ''}
                        onChange={e => setNewDebt({ ...newDebt, name: e.target.value })}
                        placeholder="名稱"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-red-500 outline-none"
                    />
                    <input
                        type="number"
                        value={newDebt.outstandingAmount || ''}
                        onChange={e => setNewDebt({ ...newDebt, outstandingAmount: Number(e.target.value) })}
                        placeholder="尚欠金額"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-red-500 outline-none"
                    />
                    <input
                        type="number"
                        value={newDebt.monthlyPayment || ''}
                        onChange={e => setNewDebt({ ...newDebt, monthlyPayment: Number(e.target.value) })}
                        placeholder="每月還款"
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-red-500 outline-none"
                    />
                    <button
                        onClick={handleAddDebt}
                        className="bg-red-700 hover:bg-red-600 text-white text-sm rounded px-3 py-1 flex items-center justify-center gap-1 transition-colors"
                    >
                        <Plus size={14} /> 新增
                    </button>
                </div>
            </div>
        </TianJiCard>
    );
};
