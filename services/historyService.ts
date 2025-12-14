/**
 * 歷史紀錄服務 - 管理每日快照和目標
 */

import { DailySnapshot, Goal, HistoryState } from '../types';

const HISTORY_KEY = 'tianji_history_v1';

// 取得今天的日期字串 (YYYY-MM-DD)
export const getTodayString = (): string => {
    return new Date().toISOString().split('T')[0];
};

// 取得歷史紀錄
export const getHistory = (): HistoryState => {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('讀取歷史紀錄失敗:', e);
    }

    return {
        snapshots: [],
        goals: [],
        lastSnapshotDate: ''
    };
};

// 儲存歷史紀錄
export const saveHistory = (history: HistoryState): void => {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        console.log('✅ 歷史紀錄已儲存');
    } catch (e) {
        console.error('儲存歷史紀錄失敗:', e);
    }
};

// 儲存快照 - 每日最多 5 筆，隔天只保留最新一筆
export const saveSnapshot = (snapshot: DailySnapshot): void => {
    const history = getHistory();
    const today = getTodayString();

    // 先清理過去的快照（每天只保留最新一筆）
    cleanupOldSnapshots(history, today);

    // 產生唯一 ID: YYYY-MM-DD-HH:mm:ss
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const snapshotId = `${today}-${timeStr}`;
    snapshot.id = snapshotId;

    // 取得今天的快照
    const todaySnapshots = history.snapshots.filter(s => s.id.startsWith(today));

    // 如果今天已經有 5 筆，刪除最舊的一筆
    if (todaySnapshots.length >= 5) {
        const oldestToday = todaySnapshots[0]; // 已排序，第一筆最舊
        history.snapshots = history.snapshots.filter(s => s.id !== oldestToday.id);
        console.log(`🗑️ 刪除今日最舊快照: ${oldestToday.id}`);
    }

    // 新增快照
    history.snapshots.push(snapshot);
    console.log(`📸 新增快照: ${snapshotId}`);

    // 按 ID 排序
    history.snapshots.sort((a, b) => a.id.localeCompare(b.id));
    history.lastSnapshotDate = today;

    saveHistory(history);
};

// 清理過去的快照 - 每天只保留最新一筆
const cleanupOldSnapshots = (history: HistoryState, today: string): void => {
    // 取得所有過去的日期（不包含今天）
    const pastDates = new Set<string>();
    history.snapshots.forEach(s => {
        const date = s.id.split('-').slice(0, 3).join('-'); // YYYY-MM-DD
        if (date !== today) {
            pastDates.add(date);
        }
    });

    // 對每個過去的日期，只保留最新一筆
    pastDates.forEach(date => {
        const daySnapshots = history.snapshots.filter(s => s.id.startsWith(date));
        if (daySnapshots.length > 1) {
            // 保留最新的（最後一筆）
            const toKeep = daySnapshots[daySnapshots.length - 1];
            const toDelete = daySnapshots.slice(0, -1);

            toDelete.forEach(s => {
                history.snapshots = history.snapshots.filter(snap => snap.id !== s.id);
                console.log(`🧹 清理舊快照: ${s.id}`);
            });

            // 將保留的快照 ID 改為純日期（方便圖表顯示）
            toKeep.id = date;
        }
    });
};

// 檢查是否需要今日快照
// 條件: 下午4點後 且 今天沒有快照
// 或者: 開啟時在 4PM-9AM 之間 且 今天沒有快照
export const shouldTakeSnapshot = (): boolean => {
    const now = new Date();
    const hour = now.getHours();
    const today = getTodayString();
    const history = getHistory();

    // 今天已經有快照了
    if (history.lastSnapshotDate === today) {
        return false;
    }

    // 下午4點到隔天早上9點之間
    if (hour >= 16 || hour < 9) {
        return true;
    }

    return false;
};

// 取得快照
export const getSnapshots = (): DailySnapshot[] => {
    return getHistory().snapshots;
};

// 取得最近 N 天的快照
export const getRecentSnapshots = (days: number = 30): DailySnapshot[] => {
    const snapshots = getSnapshots();
    return snapshots.slice(-days);
};

// 波段分析
export const getWaveAnalysis = () => {
    const snapshots = getSnapshots();

    if (snapshots.length === 0) {
        return null;
    }

    const netWorths = snapshots.map(s => s.netWorth);
    const allTimeHigh = Math.max(...netWorths);
    const allTimeLow = Math.min(...netWorths);
    const current = snapshots[snapshots.length - 1]?.netWorth || 0;

    // 找到高點和低點的日期
    const highSnapshot = snapshots.find(s => s.netWorth === allTimeHigh);
    const lowSnapshot = snapshots.find(s => s.netWorth === allTimeLow);

    // 目前位置百分比 (0% = 歷史低點, 100% = 歷史高點)
    const range = allTimeHigh - allTimeLow;
    const currentPosition = range > 0 ? ((current - allTimeLow) / range) * 100 : 50;

    // 離高點/低點距離
    const distanceFromHigh = allTimeHigh > 0 ? ((allTimeHigh - current) / allTimeHigh) * 100 : 0;
    const distanceFromLow = allTimeLow > 0 ? ((current - allTimeLow) / allTimeLow) * 100 : 0;

    return {
        allTimeHigh,
        allTimeLow,
        highDate: highSnapshot?.id || '',
        lowDate: lowSnapshot?.id || '',
        current,
        currentPosition,
        distanceFromHigh,
        distanceFromLow,
        totalSnapshots: snapshots.length
    };
};

// --- 目標管理 ---

// 取得所有目標
export const getGoals = (): Goal[] => {
    return getHistory().goals;
};

// 新增目標
export const addGoal = (goal: Goal): void => {
    const history = getHistory();
    history.goals.push(goal);
    saveHistory(history);
};

// 更新目標 (標記達成)
export const updateGoal = (goalId: string, updates: Partial<Goal>): void => {
    const history = getHistory();
    const index = history.goals.findIndex(g => g.id === goalId);
    if (index >= 0) {
        history.goals[index] = { ...history.goals[index], ...updates };
        saveHistory(history);
    }
};

// 刪除目標
export const deleteGoal = (goalId: string): void => {
    const history = getHistory();
    history.goals = history.goals.filter(g => g.id !== goalId);
    saveHistory(history);
};

// 檢查目標達成狀態
export const checkGoalProgress = (goal: Goal, currentNetWorth: number) => {
    const progress = (currentNetWorth / goal.targetAmount) * 100;
    const remaining = goal.targetAmount - currentNetWorth;
    const isAchieved = currentNetWorth >= goal.targetAmount;

    return {
        progress: Math.min(progress, 100),
        remaining: Math.max(remaining, 0),
        isAchieved
    };
};
