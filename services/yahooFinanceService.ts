/**
 * 美股即時價格服務
 * 
 * 使用 Yahoo Finance 公開資料取得美股即時價格
 * 不需要 API Key，但可能有延遲或被限制
 */

// Yahoo Finance 公開 API 端點
const YAHOO_API = 'https://query1.finance.yahoo.com/v8/finance/chart';

export interface USStockQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    currency: string;
}

/**
 * 從 Yahoo Finance 取得美股即時價格
 * @param symbol 股票代號 (e.g., AAPL, TSLA, NVDA)
 */
export const getUSStockPrice = async (symbol: string): Promise<number | null> => {
    try {
        const response = await fetch(`/api/yahoo/${symbol.toUpperCase()}?interval=1d&range=1d`);

        if (!response.ok) {
            console.error(`Yahoo API 錯誤: ${response.status}`);
            return null;
        }

        const data = await response.json();

        // 解析 Yahoo Finance 回傳格式
        const result = data?.chart?.result?.[0];
        if (!result) {
            console.error(`找不到 ${symbol} 的資料`);
            return null;
        }

        // 取得最新價格
        const meta = result.meta;
        const price = meta?.regularMarketPrice || meta?.previousClose;

        return price || null;

    } catch (error) {
        console.error(`取得 ${symbol} 價格失敗:`, error);
        return null;
    }
};

/**
 * 批次取得多檔美股價格
 * @param symbols 股票代號陣列
 */
export const getUSStockPrices = async (symbols: string[]): Promise<Record<string, number>> => {
    const results: Record<string, number> = {};

    // 逐一取得 (Yahoo 有請求限制)
    for (const symbol of symbols) {
        const price = await getUSStockPrice(symbol);
        if (price !== null) {
            results[symbol.toUpperCase()] = price;
        }
        // 加入延遲避免被限制
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
};

/**
 * 取得完整報價資訊
 */
export const getUSStockQuote = async (symbol: string): Promise<USStockQuote | null> => {
    try {
        const response = await fetch(`/api/yahoo/${symbol.toUpperCase()}?interval=1d&range=1d`);

        if (!response.ok) return null;

        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;

        if (!meta) return null;

        return {
            symbol: symbol.toUpperCase(),
            price: meta.regularMarketPrice || meta.previousClose || 0,
            change: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
            changePercent: meta.regularMarketPrice && meta.previousClose
                ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
                : 0,
            currency: meta.currency || 'USD'
        };

    } catch (error) {
        console.error(`取得 ${symbol} 報價失敗:`, error);
        return null;
    }
};
