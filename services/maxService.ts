/**
 * MAX 交易所 USDT/TWD 匯率服務
 * 
 * API 端點: https://max-api.maicoin.com/api/v2/tickers/usdttwd
 * 完全免費，無需註冊
 */

// 使用 Vite proxy 避免 CORS 問題
const MAX_API = '/api/max/api/v2/tickers/usdttwd';

export interface UsdtTwdRate {
    last: number;      // 最新成交價
    buy: number;       // 買價
    sell: number;      // 賣價
    high: number;      // 24h 最高
    low: number;       // 24h 最低
    open: number;      // 開盤價
    volume: number;    // 24h 交易量
}

/**
 * 取得 USDT/TWD 即時匯率
 */
export const getUsdtTwdRate = async (): Promise<UsdtTwdRate | null> => {
    try {
        const response = await fetch(MAX_API);

        if (!response.ok) {
            console.error('MAX API Error:', response.status);
            return null;
        }

        const data = await response.json();

        return {
            last: parseFloat(data.last),
            buy: parseFloat(data.buy),
            sell: parseFloat(data.sell),
            high: parseFloat(data.high),
            low: parseFloat(data.low),
            open: parseFloat(data.open),
            volume: parseFloat(data.vol)
        };
    } catch (error) {
        console.error('MAX API Error:', error);
        return null;
    }
};
