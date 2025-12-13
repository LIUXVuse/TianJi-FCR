import { AnalysisResult, StockPosition, CryptoPosition } from '../types';
import { getTodayBaZi } from './baziService';

const apiKey = process.env.DEEPSEEK_API_KEY || '';
// 使用 Vite proxy 避免 CORS 問題
const BASE_URL = '/api/deepseek';

/**
 * 核心人設 - 命理財務軍師（不可修改）
 */
const CORE_PERSONA = `你是一位精通《子平八字》、《紫微斗數》、《六壬神課》，且深諳現代科技（程式碼、加密貨幣、AI）與商業戰略的 30 年經驗命理大師，同時精通理財、擁有超強的商業嗅覺（自稱「老夫」）。

🎭 風格與價值觀：
- 半文半白、語氣狂妄但邏輯嚴密、一針見血、不講廢話
- 實用主義，不談道德說教，只談氣數利弊
- 支持「賽博修仙」（利用規則漏洞、數位永生）

🎯 核心任務：
- 擔任用戶的軍師，協助制定最佳財務策略
- 結合命理智慧與現代金融分析
- 根據天時（日期/流年）、地利（市場環境）、人和（個人資料）給出建議

📊 財務顧問能力：
1. 分析用戶的財務數據，評估整體風險狀況
2. 槓桿過高時警告，給出具體減倉建議
3. 結合八字用神、紫微流年等給出時機判斷
4. 直接指出問題，給出可執行的建議`;

/**
 * 預設的用戶人設範例（用於 placeholder）
 */
export const DEFAULT_USER_PERSONA_EXAMPLE = `👤 命主資料範例（可自訂）：
姓名：[你的名字]
八字資料：[日柱/月令/用神等]
紫微流年：[當年流年資訊]
投資目標：[如：5年內財富自由]
風險偏好：[保守/穩健/激進]`;

/**
 * 組合完整的 System Prompt
 * @param customPersona 用戶自訂的額外人設資料
 */
const buildSystemPrompt = (customPersona?: string): string => {
    let prompt = CORE_PERSONA;

    // 使用 lunar-javascript 精確計算今日天時
    try {
        prompt += '\n\n' + getTodayBaZi();
    } catch (e) {
        console.error('取得今日天時失敗:', e);
        const now = new Date();
        prompt += `\n\n📅 今日：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    }

    // 如果用戶有自訂人設，合併進去
    if (customPersona && customPersona.trim()) {
        prompt += `\n\n👤 命主資料（用戶提供）：
${customPersona.trim()}`;
    }

    return prompt;
};

/**
 * 取得天機財務顧問建議
 * @param data 財務分析結果
 * @param stocks 台股持倉明細
 * @param cryptos 加密貨幣持倉明細
 * @param customPersona 用戶自訂人設（會與核心人設合併）
 * @param userQuestion 用戶問題（可選）
 */
export const getTianJiAdvice = async (
    data: AnalysisResult,
    stocks: StockPosition[] = [],
    cryptos: CryptoPosition[] = [],
    customPersona?: string,
    userQuestion?: string
): Promise<string> => {
    if (!apiKey) {
        return "施主，我看你印堂發黑...啊不是，是系統找不到 API Key，老夫無法通靈。（請配置 DEEPSEEK_API_KEY）";
    }

    // 組合完整的 System Prompt（核心人設 + 今日日期 + 用戶額外資料）
    const systemPrompt = buildSystemPrompt(customPersona);

    // 建構完整財務數據
    const stockDetails = stocks.length > 0
        ? stocks.map(s => {
            const pnl = (s.price - s.costPrice) * s.shares;
            const pnlPercent = s.costPrice > 0 ? ((s.price - s.costPrice) / s.costPrice * 100).toFixed(2) : '0';
            return `  - ${s.name}: 成本${s.costPrice}→現價${s.price}, ${s.shares}股, 損益${pnl >= 0 ? '+' : ''}${Math.round(pnl)}元 (${pnlPercent}%)${s.isMargin ? ' [融資]' : ''}${s.pledgeRate > 0 ? ` [質押${s.pledgeRate}%]` : ''}`;
        }).join('\n')
        : '  (無台股部位)';

    const cryptoDetails = cryptos.length > 0
        ? cryptos.map(c => {
            const typeLabel = c.type === 'SPOT' ? '現貨' : `合約${c.leverage}x`;
            return `  - ${c.symbol} [${typeLabel}]: 均價${c.entryPrice}→現價${c.currentPrice}, 損益${c.pnl >= 0 ? '+' : ''}${c.pnl.toFixed(2)}U (${c.pnlPercent.toFixed(2)}%)`;
        }).join('\n')
        : '  (無加密貨幣部位)';

    const userMessage = `📊 命主當前財務狀況：

【總覽】
- 總淨值 (TWD): ${Math.round(data.netWorth).toLocaleString()}
- 真實槓桿倍數: ${data.realLeverage.toFixed(2)}倍
- 總曝險金額 (TWD): ${Math.round(data.totalExposure).toLocaleString()}

【台股】
- 台股槓桿: ${data.stockLeverage.toFixed(2)}倍
- 整戶維持率: ${data.stockMaintenanceRate ? data.stockMaintenanceRate.toFixed(2) + '%' : '無融資'}
- 台股損益: ${data.totalStockPnL >= 0 ? '+' : ''}${Math.round(data.totalStockPnL).toLocaleString()} TWD (${data.totalStockPnLPercent.toFixed(2)}%)
${stockDetails}

【加密貨幣】
- 幣圈槓桿: ${data.cryptoLeverage.toFixed(2)}倍
- 幣圈損益: ${data.totalCryptoPnL >= 0 ? '+' : ''}${data.totalCryptoPnL.toFixed(2)} USDT (${data.totalCryptoPnLPercent.toFixed(2)}%)
${cryptoDetails}

${userQuestion ? `\n🎯 命主提問：${userQuestion}` : '請根據以上財務數據與今日天時，給出具體的財務規劃建議和風險分析。'}`;

    try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                stream: false,
                max_tokens: 2000  // 放寬字數限制
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek API Error:', response.status, errorText);
            return `老夫法力不足（API ${response.status}），施主自求多福。`;
        }

        const result = await response.json();
        return result.choices?.[0]?.message?.content || "天機洩漏太多，訊號中斷...";
    } catch (error) {
        console.error("DeepSeek Error:", error);
        return "老夫今日法力不足（網路錯誤），施主自求多福。";
    }
};

/**
 * 取得/儲存自訂人設
 */
const PERSONA_KEY = 'tianji_custom_persona';

export const saveCustomPersona = (persona: string): void => {
    localStorage.setItem(PERSONA_KEY, persona);
};

export const getCustomPersona = (): string | null => {
    return localStorage.getItem(PERSONA_KEY);
};

export const clearCustomPersona = (): void => {
    localStorage.removeItem(PERSONA_KEY);
};

// 導出範例用於 UI placeholder
export const DEFAULT_PERSONA = DEFAULT_USER_PERSONA_EXAMPLE;
