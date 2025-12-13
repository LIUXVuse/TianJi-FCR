/**
 * 台灣證券交易所 (TWSE) 即時報價服務
 * 
 * API 端點: https://mis.twse.com.tw/stock/api/getStockInfo.jsp
 * 限制: 每 5 秒最多 3 次請求
 * 
 * 盤中時間 (週一至五 09:00-13:30): 使用即時價格 (z)
 * 盤後時間: 使用收盤價格 (z 或 y)
 */
// 使用 Vite proxy 避免 CORS 問題
const TWSE_API = '/api/twse/stock/api/getStockInfo.jsp';

/**
 * 判斷現在是否為台股盤中時間
 * 週一至五 09:00 - 13:30
 */
export const isTradingHours = (): boolean => {
    const now = new Date();
    const day = now.getDay(); // 0=週日, 1-5=週一至五, 6=週六
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeNum = hours * 100 + minutes; // e.g., 930 for 09:30

    // 週一到週五
    if (day >= 1 && day <= 5) {
        // 09:00 - 13:30
        return timeNum >= 900 && timeNum <= 1330;
    }
    return false;
};

/**
 * 從股票名稱中提取股票代號
 * 支援格式: "2330", "2330台積電", "台積電2330", "2330 台積電"
 * @param name 股票名稱（可能包含代號）
 * @returns 股票代號 (4-6 位數字) 或 null
 */
export const extractStockCode = (name: string): string | null => {
    // 匹配 4-6 位連續數字（台股代號）
    const match = name.match(/\d{4,6}/);
    return match ? match[0] : null;
};

/**
 * 取得單一股票的即時/收盤價格
 * @param stockCode 股票代號 (如 "2330")
 * @param isTPEx 是否為上櫃股票 (預設為上市 tse)
 * @returns { price, name, change } 或 null
 */
export const getStockPrice = async (
    stockCode: string,
    isTPEx: boolean = false
): Promise<{ price: number; name: string; prevClose: number; change: number } | null> => {
    try {
        const exchange = isTPEx ? 'otc' : 'tse';
        const url = `${TWSE_API}?ex_ch=${exchange}_${stockCode}.tw`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error('TWSE API Error:', response.status);
            return null;
        }

        const data = await response.json();

        if (!data.msgArray || data.msgArray.length === 0) {
            // 可能是上櫃股票，嘗試 OTC
            if (!isTPEx) {
                return getStockPrice(stockCode, true);
            }
            console.error(`找不到股票: ${stockCode}`);
            return null;
        }

        const stock = data.msgArray[0];

        // z = 最新成交價, y = 昨日收盤價
        const latestPrice = parseFloat(stock.z) || parseFloat(stock.y) || 0;
        const prevClose = parseFloat(stock.y) || 0;
        const change = prevClose > 0 ? ((latestPrice - prevClose) / prevClose) * 100 : 0;

        return {
            price: latestPrice,
            name: stock.n || stockCode,
            prevClose,
            change
        };
    } catch (error) {
        console.error('TWSE API Error:', error);
        return null;
    }
};

/**
 * 批次取得多檔股票價格
 * @param stockCodes 股票代號陣列
 * @returns 價格對照表 { "2330": { price, name, ... }, ... }
 */
export const getStockPrices = async (
    stockCodes: string[]
): Promise<Record<string, { price: number; name: string; prevClose: number; change: number } | null>> => {
    const results: Record<string, { price: number; name: string; prevClose: number; change: number } | null> = {};

    // 為避免超過 API 限制，每次最多請求 3 檔
    for (let i = 0; i < stockCodes.length; i += 3) {
        const batch = stockCodes.slice(i, i + 3);

        await Promise.all(
            batch.map(async (code) => {
                results[code] = await getStockPrice(code);
            })
        );

        // 如果還有更多股票，等待 1.5 秒避免超過限制
        if (i + 3 < stockCodes.length) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    return results;
};

/**
 * 取得價格狀態說明
 */
export const getPriceStatus = (): string => {
    if (isTradingHours()) {
        return '📈 盤中即時';
    }
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) {
        return '🌙 週末休市';
    }
    return '🌙 盤後收盤價';
};
