import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { GripVertical, Lock, Unlock } from 'lucide-react';

const STORAGE_KEY = 'tianji_dashboard_order';

interface DashboardItem {
    id: string;
    label: string;
    component: ReactNode;
}

interface DraggableDashboardProps {
    items: DashboardItem[];
}

// 讀取儲存的順序
const loadOrder = (): string[] | null => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
};

// 儲存順序
const saveOrder = (order: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
};

export const DraggableDashboard: React.FC<DraggableDashboardProps> = ({ items }) => {
    const [orderedItems, setOrderedItems] = useState<DashboardItem[]>(items);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(true); // 預設鎖定，避免誤觸

    // 初始化時載入儲存的順序
    useEffect(() => {
        const savedOrder = loadOrder();
        if (savedOrder && savedOrder.length === items.length) {
            const reordered = savedOrder
                .map(id => items.find(item => item.id === id))
                .filter((item): item is DashboardItem => item !== undefined);

            // 確保所有項目都在
            if (reordered.length === items.length) {
                setOrderedItems(reordered);
            } else {
                setOrderedItems(items);
            }
        } else {
            setOrderedItems(items);
        }
    }, [items]);

    // 當 items 更新時同步（但保留順序）
    useEffect(() => {
        setOrderedItems(prev => {
            const currentIds = prev.map(p => p.id);
            const newItems = items.map(item => {
                const existingIndex = currentIds.indexOf(item.id);
                return existingIndex >= 0 ? { ...prev[existingIndex], component: item.component } : item;
            });
            return newItems.sort((a, b) => {
                const aIdx = currentIds.indexOf(a.id);
                const bIdx = currentIds.indexOf(b.id);
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            });
        });
    }, [items]);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        if (isLocked) return;
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId || isLocked) return;

        setOrderedItems(prev => {
            const newItems = [...prev];
            const draggedIndex = newItems.findIndex(item => item.id === draggedId);
            const targetIndex = newItems.findIndex(item => item.id === targetId);

            if (draggedIndex === -1 || targetIndex === -1) return prev;

            // 移動項目
            const [removed] = newItems.splice(draggedIndex, 1);
            newItems.splice(targetIndex, 0, removed);

            // 儲存新順序
            saveOrder(newItems.map(item => item.id));

            return newItems;
        });

        setDraggedId(null);
    }, [draggedId, isLocked]);

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    return (
        <div className="space-y-4">
            {/* 控制列 */}
            <div className="flex justify-end">
                <button
                    onClick={() => setIsLocked(!isLocked)}
                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full transition-all ${isLocked
                            ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            : 'bg-purple-600 text-white animate-pulse'
                        }`}
                    title={isLocked ? '點擊解鎖以拖放排序' : '拖放模式啟用中'}
                >
                    {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    {isLocked ? '🔒 固定佈局' : '✨ 拖放編輯中'}
                </button>
            </div>

            {/* 可拖放區域 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {orderedItems.map((item) => (
                    <div
                        key={item.id}
                        draggable={!isLocked}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className={`relative transition-all duration-200 ${draggedId === item.id ? 'opacity-50 scale-95' : ''
                            } ${!isLocked ? 'cursor-move' : ''
                            }`}
                    >
                        {/* 拖放手柄 */}
                        {!isLocked && (
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 bg-purple-600 rounded-l px-1 py-2 text-white opacity-70 hover:opacity-100 transition-opacity">
                                <GripVertical size={14} />
                            </div>
                        )}

                        {/* 組件內容 */}
                        <div className={`${!isLocked ? 'ring-2 ring-purple-500/30 rounded-xl' : ''}`}>
                            {item.component}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
