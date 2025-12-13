/**
 * 專業八字計算服務 (BaZi Calculator)
 * 
 * 使用 lunar-javascript 庫（6tail 開發，業界權威）
 * 精確處理：立春換年、節氣換月、真太陽時等
 * 
 * @see https://github.com/6tail/lunar-javascript
 */

// @ts-ignore - lunar-javascript 沒有 TypeScript 類型定義
import { Solar, Lunar, EightChar } from 'lunar-javascript';

export interface BaZiResult {
    // 四柱
    yearPillar: { gan: string; zhi: string; ganZhi: string };
    monthPillar: { gan: string; zhi: string; ganZhi: string };
    dayPillar: { gan: string; zhi: string; ganZhi: string };
    hourPillar: { gan: string; zhi: string; ganZhi: string };

    // 日主 (Day Master)
    dayMaster: string;
    dayMasterElement: string;

    // 生肖
    zodiac: string;

    // 五行統計
    wuXingCount: Record<string, number>;

    // 節氣相關
    jieQi: string;      // 當前節氣
    lunarDate: string;  // 農曆日期

    // 格式化輸出
    formatted: string;

    // 原始對象（供進階使用）
    raw?: EightChar;
}

export interface BirthInfo {
    year: number;
    month: number;  // 1-12
    day: number;
    hour: number;   // 0-23
    minute?: number; // 0-59
}

// 天干五行對照
const GAN_WU_XING: Record<string, string> = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水'
};

// 地支五行對照
const ZHI_WU_XING: Record<string, string> = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

/**
 * 計算五行統計
 */
const countWuXing = (pillars: Array<{ gan: string; zhi: string }>): Record<string, number> => {
    const count: Record<string, number> = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };

    pillars.forEach(p => {
        if (GAN_WU_XING[p.gan]) count[GAN_WU_XING[p.gan]] += 1;
        if (ZHI_WU_XING[p.zhi]) count[ZHI_WU_XING[p.zhi]] += 1;
    });

    return count;
};

/**
 * 主函數：使用 lunar-javascript 精確計算八字
 */
export const calculateBaZi = (birth: BirthInfo): BaZiResult => {
    const { year, month, day, hour, minute = 0 } = birth;

    // 使用 lunar-javascript 創建日期對象
    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();
    const bazi = lunar.getEightChar();

    // 取得四柱
    const yearGan = bazi.getYearGan();
    const yearZhi = bazi.getYearZhi();
    const monthGan = bazi.getMonthGan();
    const monthZhi = bazi.getMonthZhi();
    const dayGan = bazi.getDayGan();
    const dayZhi = bazi.getDayZhi();
    const hourGan = bazi.getTimeGan();
    const hourZhi = bazi.getTimeZhi();

    // 組裝四柱
    const yearPillar = { gan: yearGan, zhi: yearZhi, ganZhi: yearGan + yearZhi };
    const monthPillar = { gan: monthGan, zhi: monthZhi, ganZhi: monthGan + monthZhi };
    const dayPillar = { gan: dayGan, zhi: dayZhi, ganZhi: dayGan + dayZhi };
    const hourPillar = { gan: hourGan, zhi: hourZhi, ganZhi: hourGan + hourZhi };

    // 日主資訊
    const dayMaster = dayGan;
    const dayMasterElement = GAN_WU_XING[dayMaster] || '未知';

    // 生肖（用年支判斷）
    const zodiac = lunar.getYearShengXiao();

    // 五行統計
    const wuXingCount = countWuXing([yearPillar, monthPillar, dayPillar, hourPillar]);

    // 節氣
    const jieQi = lunar.getJieQi() || lunar.getPrevJieQi()?.getName() || '';

    // 農曆日期
    const lunarMonth = lunar.getMonthInChinese();
    const lunarDay = lunar.getDayInChinese();
    const lunarDate = `${lunar.getYearInGanZhi()}年 ${lunarMonth}月${lunarDay}`;

    // 時辰名稱對照
    const shiChenNames: Record<string, string> = {
        '子': '子時 (23:00-01:00)',
        '丑': '丑時 (01:00-03:00)',
        '寅': '寅時 (03:00-05:00)',
        '卯': '卯時 (05:00-07:00)',
        '辰': '辰時 (07:00-09:00)',
        '巳': '巳時 (09:00-11:00)',
        '午': '午時 (11:00-13:00)',
        '未': '未時 (13:00-15:00)',
        '申': '申時 (15:00-17:00)',
        '酉': '酉時 (17:00-19:00)',
        '戌': '戌時 (19:00-21:00)',
        '亥': '亥時 (21:00-23:00)'
    };

    // 格式化輸出
    const formatted = `📅 生辰八字分析（lunar-javascript 精確計算）

【四柱八字】
年柱：${yearPillar.ganZhi}
月柱：${monthPillar.ganZhi}
日柱：${dayPillar.ganZhi} ← 日主
時柱：${hourPillar.ganZhi}

【日主分析】
日主：${dayMaster}（${dayMasterElement}）
生肖：${zodiac}

【五行分布】
木${wuXingCount['木']} 火${wuXingCount['火']} 土${wuXingCount['土']} 金${wuXingCount['金']} 水${wuXingCount['水']}

【農曆資訊】
${lunarDate}
出生時辰：${shiChenNames[hourZhi] || hourZhi + '時'}
${jieQi ? `節氣：${jieQi}` : ''}`;

    return {
        yearPillar,
        monthPillar,
        dayPillar,
        hourPillar,
        dayMaster,
        dayMasterElement,
        zodiac,
        wuXingCount,
        jieQi,
        lunarDate,
        formatted,
        raw: bazi
    };
};

/**
 * 計算今日天時（用於 AI 提示詞）
 */
export const getTodayBaZi = (): string => {
    const now = new Date();
    const solar = Solar.fromDate(now);
    const lunar = solar.getLunar();
    const bazi = lunar.getEightChar();

    const yearGanZhi = bazi.getYear();
    const monthGanZhi = bazi.getMonth();
    const dayGanZhi = bazi.getDay();
    const hourGanZhi = bazi.getTime();

    const jieQi = lunar.getJieQi() || lunar.getPrevJieQi()?.getName() || '';

    return `📅 今日天時：
- 西曆：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日
- 農曆：${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}
- 四柱：${yearGanZhi} ${monthGanZhi} ${dayGanZhi} ${hourGanZhi}
- 節氣：${jieQi || '無'}`;
};

/**
 * 儲存/讀取生辰資料
 */
const BIRTH_KEY = 'tianji_birth_info';

export const saveBirthInfo = (birth: BirthInfo): void => {
    localStorage.setItem(BIRTH_KEY, JSON.stringify(birth));
};

export const getBirthInfo = (): BirthInfo | null => {
    const saved = localStorage.getItem(BIRTH_KEY);
    return saved ? JSON.parse(saved) : null;
};

export const clearBirthInfo = (): void => {
    localStorage.removeItem(BIRTH_KEY);
};
