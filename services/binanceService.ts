/**
 * 幣安公開價格 API 服務
 * 
 * 使用幣安的公開 API 取得加密貨幣即時價格
 * API 文件: https://binance-docs.github.io/apidocs/spot/en/#symbol-price-ticker
 */

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

/**
 * 取得單一幣種的 USDT 價格
 * @param symbol 幣種代號 (如: BTC, ETH, SOL)
 * @returns 價格 (USDT) 或 null（如果找不到）
 */
export const getPrice = async (symbol: string): Promise<number | null> => {
    try {
        // 自動加上 USDT 後綴
        const pair = symbol.toUpperCase().replace('/USDT', '').replace('USDT', '') + 'USDT';

        const response = await fetch(`${BINANCE_API_BASE}/ticker/price?symbol=${pair}`);

        if (!response.ok) {
            console.error(`Binance API Error: ${response.status} for ${pair}`);
            return null;
        }

        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error('Binance API Error:', error);
        return null;
    }
};

/**
 * 批次取得多個幣種的 USDT 價格
 * @param symbols 幣種代號陣列 (如: ['BTC', 'ETH', 'SOL'])
 * @returns 價格對照表 { BTC: 100000, ETH: 3500, ... }
 */
export const getPrices = async (symbols: string[]): Promise<Record<string, number | null>> => {
    const results: Record<string, number | null> = {};

    // 使用 Promise.all 同時取得所有價格
    await Promise.all(
        symbols.map(async (symbol) => {
            const normalizedSymbol = symbol.toUpperCase().replace('/USDT', '').replace('USDT', '');
            results[normalizedSymbol] = await getPrice(symbol);
        })
    );

    return results;
};

/**
 * 取得所有幣種價格（用於下拉選單或自動完成）
 * @returns 所有交易對的價格列表
 */
export const getAllPrices = async (): Promise<Array<{ symbol: string; price: string }>> => {
    try {
        const response = await fetch(`${BINANCE_API_BASE}/ticker/price`);

        if (!response.ok) {
            console.error('Binance API Error:', response.status);
            return [];
        }

        const data = await response.json();
        // 只保留 USDT 交易對
        return data.filter((item: { symbol: string }) => item.symbol.endsWith('USDT'));
    } catch (error) {
        console.error('Binance API Error:', error);
        return [];
    }
};

/**
 * 常用幣種列表（用於 UI 快速選擇）
 */
export const POPULAR_SYMBOLS = [
    'BTC',
    'ETH',
    'SOL',
    'BNB',
    'XRP',
    'DOGE',
    'ADA',
    'AVAX',
    'DOT',
    'MATIC'
];
