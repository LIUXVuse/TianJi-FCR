/**
 * USD/TWD 即時匯率服務
 * 
 * 使用 ExchangeRate-API Open Access (免費，不需要 API Key)
 * 每日更新一次
 */

const EXCHANGE_RATE_API = 'https://open.er-api.com/v6/latest/USD';

export interface ExchangeRates {
    usdTwd: number;
    lastUpdate: string;
}

/**
 * 從 ExchangeRate-API 取得 USD/TWD 匯率
 */
export const getUsdTwdRate = async (): Promise<number | null> => {
    try {
        const response = await fetch(EXCHANGE_RATE_API);

        if (!response.ok) {
            console.error(`匯率 API 錯誤: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.result !== 'success') {
            console.error('匯率 API 回傳失敗');
            return null;
        }

        const twdRate = data.rates?.TWD;

        if (twdRate) {
            console.log(`✅ USD/TWD 匯率: ${twdRate} (更新時間: ${data.time_last_update_utc})`);
            return twdRate;
        }

        return null;

    } catch (error) {
        console.error('取得 USD/TWD 匯率失敗:', error);
        return null;
    }
};

/**
 * 取得完整匯率資訊
 */
export const getExchangeRates = async (): Promise<ExchangeRates | null> => {
    try {
        const response = await fetch(EXCHANGE_RATE_API);

        if (!response.ok) return null;

        const data = await response.json();

        if (data.result !== 'success' || !data.rates?.TWD) {
            return null;
        }

        return {
            usdTwd: data.rates.TWD,
            lastUpdate: data.time_last_update_utc
        };

    } catch (error) {
        console.error('取得匯率失敗:', error);
        return null;
    }
};
