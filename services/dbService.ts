/**
 * IndexedDB 本地資料庫服務
 * 
 * 使用 IndexedDB 儲存所有應用數據，比 localStorage 更穩定可靠
 * 
 * @see API_SPEC.md - Section 11. IndexedDB Schema
 */

import {
    GlobalSettings,
    StockPosition,
    USStockPosition,
    CryptoState,
    DebtItem
} from '../types';

// 資料庫配置
const DB_NAME = 'TianJiDB';
const DB_VERSION = 1;

// Store 名稱
const STORES = {
    SETTINGS: 'settings',
    STOCK_POSITIONS: 'stockPositions',
    US_STOCK_POSITIONS: 'usStockPositions',
    CRYPTO_DATA: 'cryptoData',
    DEBTS: 'debts',
    META: 'meta',  // 存放版本、最後更新時間等
} as const;

// 完整應用狀態
export interface AppData {
    settings: GlobalSettings;
    stockPositions: StockPosition[];
    usStockPositions: USStockPosition[];
    cryptoData: CryptoState;
    debts: DebtItem[];
}

// 預設值
const DEFAULT_DATA: AppData = {
    settings: {
        usdtTwdRate: 31.3,
        usdTwdRate: 31.5,
        cashTwd: 0
    },
    stockPositions: [],
    usStockPositions: [],
    cryptoData: { walletBalance: 0, positions: [] },
    debts: []
};

// IndexedDB 實例
let dbInstance: IDBDatabase | null = null;

/**
 * 開啟資料庫連線
 */
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('❌ IndexedDB 開啟失敗:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            console.log('✅ IndexedDB 連線成功');
            resolve(dbInstance);
        };

        // 首次建立或版本升級時
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            console.log('📦 建立 IndexedDB Schema...');

            // 建立各個 Object Store
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.STOCK_POSITIONS)) {
                db.createObjectStore(STORES.STOCK_POSITIONS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.US_STOCK_POSITIONS)) {
                db.createObjectStore(STORES.US_STOCK_POSITIONS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.CRYPTO_DATA)) {
                db.createObjectStore(STORES.CRYPTO_DATA, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.DEBTS)) {
                db.createObjectStore(STORES.DEBTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.META)) {
                db.createObjectStore(STORES.META, { keyPath: 'key' });
            }

            console.log('✅ IndexedDB Schema 建立完成');
        };
    });
};

/**
 * 通用寫入函數
 */
const put = async <T>(storeName: string, data: T, key?: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        const dataWithKey = key ? { ...data, id: key } : data;
        const request = store.put(dataWithKey);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

/**
 * 通用讀取函數
 */
const get = async <T>(storeName: string, key: string): Promise<T | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
    });
};

/**
 * 讀取所有資料
 */
const getAll = async <T>(storeName: string): Promise<T[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
};

/**
 * 清空並重寫整個 Store
 */
const clearAndPutAll = async <T extends { id: string }>(storeName: string, items: T[]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        // 先清空
        store.clear();

        // 逐一寫入
        items.forEach(item => store.put(item));

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// ==========================================
// 公開 API
// ==========================================

/**
 * 儲存完整應用狀態
 */
export const saveAppData = async (data: AppData): Promise<void> => {
    try {
        // 儲存 settings (使用固定 key)
        await put(STORES.SETTINGS, { ...data.settings, id: 'main' }, 'main');

        // 儲存 positions (陣列)
        await clearAndPutAll(STORES.STOCK_POSITIONS, data.stockPositions);
        await clearAndPutAll(STORES.US_STOCK_POSITIONS, data.usStockPositions);
        await clearAndPutAll(STORES.DEBTS, data.debts);

        // 儲存 crypto data (使用固定 key)
        await put(STORES.CRYPTO_DATA, { ...data.cryptoData, id: 'main' }, 'main');

        // 更新 meta
        await put(STORES.META, { key: 'lastUpdated', value: new Date().toISOString() });

        // 同時保留 localStorage 備份
        localStorage.setItem('tianji_data_v2', JSON.stringify(data));

    } catch (error) {
        console.error('❌ 儲存資料失敗:', error);
        throw error;
    }
};

/**
 * 讀取完整應用狀態
 */
export const loadAppData = async (): Promise<AppData> => {
    try {
        const db = await openDB();

        // 讀取各項資料
        const settingsResult = await get<GlobalSettings & { id: string }>(STORES.SETTINGS, 'main');
        const stockPositions = await getAll<StockPosition>(STORES.STOCK_POSITIONS);
        const usStockPositions = await getAll<USStockPosition>(STORES.US_STOCK_POSITIONS);
        const cryptoResult = await get<CryptoState & { id: string }>(STORES.CRYPTO_DATA, 'main');
        const debts = await getAll<DebtItem>(STORES.DEBTS);

        // 如果 IndexedDB 有資料
        if (settingsResult || stockPositions.length > 0 || cryptoResult) {
            console.log('📂 從 IndexedDB 載入資料');

            // 移除 id 欄位
            const settings = settingsResult ? (({ id, ...rest }) => rest)(settingsResult) as GlobalSettings : DEFAULT_DATA.settings;
            const cryptoData = cryptoResult ? (({ id, ...rest }) => rest)(cryptoResult) as CryptoState : DEFAULT_DATA.cryptoData;

            return {
                settings,
                stockPositions,
                usStockPositions,
                cryptoData,
                debts
            };
        }

        // IndexedDB 沒資料，嘗試從 localStorage 遷移
        console.log('🔄 嘗試從 localStorage 遷移資料...');
        const migrated = await migrateFromLocalStorage();
        if (migrated) {
            return migrated;
        }

        // 完全沒資料，返回預設值
        return DEFAULT_DATA;

    } catch (error) {
        console.error('❌ 讀取資料失敗:', error);

        // 降級到 localStorage
        return loadFromLocalStorage();
    }
};

/**
 * 從 localStorage 遷移到 IndexedDB
 */
const migrateFromLocalStorage = async (): Promise<AppData | null> => {
    // 嘗試讀取 v2
    let data = localStorage.getItem('tianji_data_v2');

    // 嘗試讀取 v1
    if (!data) {
        data = localStorage.getItem('tianji_data_v1');
    }

    if (!data) {
        return null;
    }

    try {
        const parsed = JSON.parse(data);
        console.log('📦 從 localStorage 遷移到 IndexedDB...');

        const appData: AppData = {
            settings: {
                usdtTwdRate: parsed.settings?.usdtTwdRate || 31.3,
                usdTwdRate: parsed.settings?.usdTwdRate || 31.5,
                cashTwd: parsed.settings?.cashTwd || 0
            },
            stockPositions: parsed.stockPositions || [],
            usStockPositions: parsed.usStockPositions || [],
            cryptoData: parsed.cryptoData || { walletBalance: 0, positions: [] },
            debts: parsed.debts || []
        };

        // 儲存到 IndexedDB
        await saveAppData(appData);
        console.log('✅ 遷移完成！');

        return appData;

    } catch (error) {
        console.error('遷移失敗:', error);
        return null;
    }
};

/**
 * 從 localStorage 讀取 (降級方案)
 */
const loadFromLocalStorage = (): AppData => {
    try {
        const data = localStorage.getItem('tianji_data_v2') || localStorage.getItem('tianji_data_v1');
        if (data) {
            const parsed = JSON.parse(data);
            return {
                settings: parsed.settings || DEFAULT_DATA.settings,
                stockPositions: parsed.stockPositions || [],
                usStockPositions: parsed.usStockPositions || [],
                cryptoData: parsed.cryptoData || DEFAULT_DATA.cryptoData,
                debts: parsed.debts || []
            };
        }
    } catch (error) {
        console.error('localStorage 讀取失敗:', error);
    }
    return DEFAULT_DATA;
};

/**
 * 清除所有資料 (危險操作)
 */
export const clearAllData = async (): Promise<void> => {
    const db = await openDB();

    const storeNames = [
        STORES.SETTINGS,
        STORES.STOCK_POSITIONS,
        STORES.US_STOCK_POSITIONS,
        STORES.CRYPTO_DATA,
        STORES.DEBTS,
        STORES.META
    ];

    for (const storeName of storeNames) {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
    }

    localStorage.removeItem('tianji_data_v1');
    localStorage.removeItem('tianji_data_v2');

    console.log('🗑️ 所有資料已清除');
};

/**
 * 匯出資料為 JSON (備份功能)
 */
export const exportData = async (): Promise<string> => {
    const data = await loadAppData();
    return JSON.stringify(data, null, 2);
};

/**
 * 匯入 JSON 資料 (還原功能)
 */
export const importData = async (jsonString: string): Promise<void> => {
    const data = JSON.parse(jsonString) as AppData;
    await saveAppData(data);
};
