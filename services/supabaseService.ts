/**
 * Supabase 雲端同步服務
 * 提供跨瀏覽器資料同步功能
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
    GlobalSettings,
    StockPosition,
    USStockPosition,
    CryptoPosition,
    DebtItem,
    DailySnapshot,
    Goal,
    CryptoState
} from '../types';

// Supabase 設定 - 從環境變數讀取
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 檢查設定是否存在
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase 環境變數未設定，雲端同步功能將無法使用');
    console.warn('請在 .env.local 中設定 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
}

// 建立 Supabase 客戶端
let supabase: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabase;
};

// ============ 設定 (Settings) ============

export interface CloudSettings extends GlobalSettings {
    walletBalance?: number;
}

export const saveSettingsToCloud = async (settings: GlobalSettings, walletBalance: number = 0): Promise<boolean> => {
    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('user_settings')
            .upsert({
                id: 'default', // 單用戶模式
                cash_twd: settings.cashTwd,
                cash_usd: settings.cashUsd,
                usd_twd_rate: settings.usdTwdRate,
                usdt_twd_rate: settings.usdtTwdRate,
                wallet_balance: walletBalance,
                original_capital_twd: settings.originalCapitalTwd,
                original_capital_usd: settings.originalCapitalUsd,
                original_capital_usdt: settings.originalCapitalUsdt,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log('☁️ 設定已同步到雲端');
        return true;
    } catch (e) {
        console.error('❌ 設定同步失敗:', e);
        return false;
    }
};

export const loadSettingsFromCloud = async (): Promise<GlobalSettings | null> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('user_settings')
            .select('*')
            .eq('id', 'default')
            .single();

        if (error) throw error;
        if (!data) return null;

        console.log('☁️ 從雲端載入設定');
        return {
            cashTwd: data.cash_twd || 0,
            cashUsd: data.cash_usd || 0,
            usdTwdRate: data.usd_twd_rate || 31.5,
            usdtTwdRate: data.usdt_twd_rate || 31.5,
            originalCapitalTwd: data.original_capital_twd || 0,
            originalCapitalUsd: data.original_capital_usd || 0,
            originalCapitalUsdt: data.original_capital_usdt || 0
        };
    } catch (e) {
        console.error('❌ 載入雲端設定失敗:', e);
        return null;
    }
};

// 單獨載入 walletBalance
export const loadWalletBalanceFromCloud = async (): Promise<number> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('user_settings')
            .select('wallet_balance')
            .eq('id', 'default')
            .single();

        if (error) throw error;
        return data?.wallet_balance || 0;
    } catch (e) {
        console.error('❌ 載入 walletBalance 失敗:', e);
        return 0;
    }
};

// ============ 台股持倉 ============

export const saveStockPositionsToCloud = async (positions: StockPosition[]): Promise<boolean> => {
    try {
        const client = getSupabaseClient();

        // 先刪除舊資料
        await client.from('stock_positions').delete().neq('id', '');

        // 插入新資料
        if (positions.length > 0) {
            const { error } = await client.from('stock_positions').insert(
                positions.map(p => ({
                    id: p.id,
                    name: p.name,
                    shares: p.shares,
                    price: p.price,
                    cost_price: p.costPrice,
                    is_margin: p.isMargin || false,
                    pledge_rate: p.pledgeRate || 0,
                    loan_amount: p.loanAmount || 0,
                    updated_at: new Date().toISOString()
                }))
            );
            if (error) throw error;
        }

        console.log(`☁️ 台股持倉已同步 (${positions.length} 筆)`);
        return true;
    } catch (e) {
        console.error('❌ 台股同步失敗:', e);
        return false;
    }
};

export const loadStockPositionsFromCloud = async (): Promise<StockPosition[]> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('stock_positions')
            .select('*')
            .order('updated_at', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        console.log(`☁️ 從雲端載入台股 (${data.length} 筆)`);
        return data.map(d => ({
            id: d.id,
            name: d.name,
            shares: d.shares,
            price: d.price,
            costPrice: d.cost_price,
            isMargin: d.is_margin || false,
            pledgeRate: d.pledge_rate || 0,
            loanAmount: d.loan_amount || 0
        }));
    } catch (e) {
        console.error('❌ 載入台股失敗:', e);
        return [];
    }
};

// ============ 美股持倉 ============

export const saveUSStockPositionsToCloud = async (positions: USStockPosition[]): Promise<boolean> => {
    try {
        const client = getSupabaseClient();
        await client.from('us_stock_positions').delete().neq('id', '');

        if (positions.length > 0) {
            const { error } = await client.from('us_stock_positions').insert(
                positions.map(p => ({
                    id: p.id,
                    symbol: p.symbol,
                    shares: p.shares,
                    price: p.price,
                    cost_price: p.costPrice,
                    loan_amount: p.loanAmount || 0,
                    is_margin: p.isMargin || false,
                    margin_ratio: p.marginRatio || 0,
                    updated_at: new Date().toISOString()
                }))
            );
            if (error) throw error;
        }

        console.log(`☁️ 美股持倉已同步 (${positions.length} 筆)`);
        return true;
    } catch (e) {
        console.error('❌ 美股同步失敗:', e);
        return false;
    }
};

export const loadUSStockPositionsFromCloud = async (): Promise<USStockPosition[]> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('us_stock_positions')
            .select('*')
            .order('updated_at', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        console.log(`☁️ 從雲端載入美股 (${data.length} 筆)`);
        return data.map(d => ({
            id: d.id,
            symbol: d.symbol,
            name: d.symbol, // 使用 symbol 作為名稱
            shares: d.shares,
            price: d.price,
            costPrice: d.cost_price,
            loanAmount: d.loan_amount || 0,
            isMargin: d.is_margin || false,
            marginRatio: d.margin_ratio || 0,
            marketValue: d.shares * d.price,
            pnl: (d.price - d.cost_price) * d.shares,
            pnlPercent: d.cost_price > 0 ? ((d.price - d.cost_price) / d.cost_price) * 100 : 0
        }));
    } catch (e) {
        console.error('❌ 載入美股失敗:', e);
        return [];
    }
};

// ============ 幣圈持倉 ============

export const saveCryptoPositionsToCloud = async (positions: CryptoPosition[]): Promise<boolean> => {
    try {
        const client = getSupabaseClient();
        await client.from('crypto_positions').delete().neq('id', '');

        if (positions.length > 0) {
            const { error } = await client.from('crypto_positions').insert(
                positions.map(p => ({
                    id: p.id,
                    symbol: p.symbol,
                    type: p.type,
                    leverage: p.leverage,
                    margin: p.margin,
                    units: p.units,
                    entry_price: p.entryPrice,
                    current_price: p.currentPrice,
                    position_size: p.positionSize,
                    pnl: p.pnl,
                    pnl_percent: p.pnlPercent,
                    updated_at: new Date().toISOString()
                }))
            );
            if (error) throw error;
        }

        console.log(`☁️ 幣圈持倉已同步 (${positions.length} 筆)`);
        return true;
    } catch (e) {
        console.error('❌ 幣圈同步失敗:', e);
        return false;
    }
};

export const loadCryptoPositionsFromCloud = async (): Promise<CryptoPosition[]> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('crypto_positions')
            .select('*')
            .order('updated_at', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        console.log(`☁️ 從雲端載入幣圈 (${data.length} 筆)`);
        return data.map(d => ({
            id: d.id,
            symbol: d.symbol,
            type: d.type,
            leverage: d.leverage,
            margin: d.margin,
            units: d.units,
            entryPrice: d.entry_price,
            currentPrice: d.current_price,
            positionSize: d.position_size,
            pnl: d.pnl,
            pnlPercent: d.pnl_percent
        }));
    } catch (e) {
        console.error('❌ 載入幣圈失敗:', e);
        return [];
    }
};

// ============ 負債 ============

export const saveDebtsToCloud = async (debts: DebtItem[]): Promise<boolean> => {
    try {
        const client = getSupabaseClient();
        await client.from('debts').delete().neq('id', '');

        if (debts.length > 0) {
            const { error } = await client.from('debts').insert(
                debts.map(d => ({
                    id: d.id,
                    name: d.name,
                    amount: d.outstandingAmount,
                    principal: d.principalAmount,
                    monthly_payment: d.monthlyPayment,
                    interest_rate: d.interestRate,
                    type: d.type,
                    updated_at: new Date().toISOString()
                }))
            );
            if (error) throw error;
        }

        console.log(`☁️ 負債已同步 (${debts.length} 筆)`);
        return true;
    } catch (e) {
        console.error('❌ 負債同步失敗:', e);
        return false;
    }
};

export const loadDebtsFromCloud = async (): Promise<DebtItem[]> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('debts')
            .select('*')
            .order('updated_at', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        console.log(`☁️ 從雲端載入負債 (${data.length} 筆)`);
        return data.map(d => ({
            id: d.id,
            name: d.name,
            type: d.type as 'credit' | 'mortgage' | 'car' | 'other',
            principalAmount: d.principal || d.amount || 0,
            outstandingAmount: d.amount || 0,
            monthlyPayment: d.monthly_payment || 0,
            interestRate: d.interest_rate || 0
        }));
    } catch (e) {
        console.error('❌ 載入負債失敗:', e);
        return [];
    }
};

// ============ 快照 ============

export const saveSnapshotToCloud = async (snapshot: DailySnapshot): Promise<boolean> => {
    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('daily_snapshots')
            .upsert({
                id: snapshot.id,
                timestamp: snapshot.timestamp,
                net_worth: snapshot.netWorth,
                data: snapshot, // 儲存完整 JSON
                created_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log(`☁️ 快照已同步: ${snapshot.id}`);
        return true;
    } catch (e) {
        console.error('❌ 快照同步失敗:', e);
        return false;
    }
};

export const saveSnapshotsToCloud = async (snapshots: DailySnapshot[]): Promise<boolean> => {
    try {
        const client = getSupabaseClient();

        // 為了效能與一致性，與其他表一樣先刪除再插入（或使用 upsert）
        // 但快照可能很多，這裡選擇 upsert 避免誤刪歷史資料，或者根據需求
        // 這裡採用 upsert 批次處理
        if (snapshots.length === 0) return true;

        const { error } = await client
            .from('daily_snapshots')
            .upsert(
                snapshots.map(s => ({
                    id: s.id,
                    timestamp: s.timestamp,
                    net_worth: s.netWorth,
                    data: s,
                    created_at: new Date().toISOString()
                }))
            );

        if (error) throw error;
        console.log(`☁️ 快照批量同步已完成 (${snapshots.length} 筆)`);
        return true;
    } catch (e) {
        console.error('❌ 快照批量同步失敗:', e);
        return false;
    }
};

export const loadSnapshotsFromCloud = async (): Promise<DailySnapshot[]> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('daily_snapshots')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        console.log(`☁️ 從雲端載入快照 (${data.length} 筆)`);
        return data.map(d => d.data as DailySnapshot);
    } catch (e) {
        console.error('❌ 載入快照失敗:', e);
        return [];
    }
};

// ============ 目標 ============

export const saveGoalsToCloud = async (goals: Goal[]): Promise<boolean> => {
    try {
        const client = getSupabaseClient();
        await client.from('goals').delete().neq('id', '');

        if (goals.length > 0) {
            const { error } = await client.from('goals').insert(
                goals.map(g => ({
                    id: g.id,
                    name: g.name,
                    target_amount: g.targetAmount,
                    deadline: g.deadline,
                    created_at: g.createdAt,
                    achieved_at: g.achievedAt
                }))
            );
            if (error) throw error;
        }

        console.log(`☁️ 目標已同步 (${goals.length} 筆)`);
        return true;
    } catch (e) {
        console.error('❌ 目標同步失敗:', e);
        return false;
    }
};

export const loadGoalsFromCloud = async (): Promise<Goal[]> => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('goals')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        console.log(`☁️ 從雲端載入目標 (${data.length} 筆)`);
        return data.map(d => ({
            id: d.id,
            name: d.name,
            targetAmount: d.target_amount,
            deadline: d.deadline,
            createdAt: d.created_at,
            achievedAt: d.achieved_at
        }));
    } catch (e) {
        console.error('❌ 載入目標失敗:', e);
        return [];
    }
};

// ============ 全量同步 ============

export interface CloudData {
    settings: GlobalSettings | null;
    walletBalance: number;
    stockPositions: StockPosition[];
    usStockPositions: USStockPosition[];
    cryptoPositions: CryptoPosition[];
    debts: DebtItem[];
    snapshots: DailySnapshot[];
    goals: Goal[];
}

export const loadAllFromCloud = async (): Promise<CloudData> => {
    console.log('☁️ 開始從雲端載入所有資料...');

    const [settings, walletBalance, stockPositions, usStockPositions, cryptoPositions, debts, snapshots, goals] = await Promise.all([
        loadSettingsFromCloud(),
        loadWalletBalanceFromCloud(),
        loadStockPositionsFromCloud(),
        loadUSStockPositionsFromCloud(),
        loadCryptoPositionsFromCloud(),
        loadDebtsFromCloud(),
        loadSnapshotsFromCloud(),
        loadGoalsFromCloud()
    ]);

    console.log('☁️ 雲端資料載入完成');
    return { settings, walletBalance, stockPositions, usStockPositions, cryptoPositions, debts, snapshots, goals };
};

export const saveAllToCloud = async (data: CloudData): Promise<boolean> => {
    console.log('☁️ 開始同步所有資料到雲端...');

    const results = await Promise.all([
        data.settings ? saveSettingsToCloud(data.settings) : Promise.resolve(true),
        saveStockPositionsToCloud(data.stockPositions),
        saveUSStockPositionsToCloud(data.usStockPositions),
        saveCryptoPositionsToCloud(data.cryptoPositions),
        saveDebtsToCloud(data.debts),
        saveSnapshotsToCloud(data.snapshots),
        saveGoalsToCloud(data.goals)
    ]);

    const success = results.every(r => r);
    console.log(success ? '☁️ 雲端同步完成' : '⚠️ 部分資料同步失敗');
    return success;
};

// ============ 連線測試 ============

export const testConnection = async (): Promise<boolean> => {
    try {
        const client = getSupabaseClient();
        const { error } = await client.from('user_settings').select('id').limit(1);
        if (error) throw error;
        console.log('☁️ Supabase 連線成功');
        return true;
    } catch (e) {
        console.error('❌ Supabase 連線失敗:', e);
        return false;
    }
};
