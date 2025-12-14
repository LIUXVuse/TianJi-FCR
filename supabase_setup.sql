-- ============================================
-- 天機·火控雷達 Supabase 資料表建立腳本 (完整版)
-- 在 Supabase Dashboard > SQL Editor 執行此腳本
-- ============================================

-- 1. 用戶設定
CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    cash_twd NUMERIC DEFAULT 0,
    cash_usd NUMERIC DEFAULT 0,
    usd_twd_rate NUMERIC DEFAULT 31.5,
    usdt_twd_rate NUMERIC DEFAULT 31.5,
    wallet_balance NUMERIC DEFAULT 0,
    original_capital_twd NUMERIC DEFAULT 0,
    original_capital_usd NUMERIC DEFAULT 0,
    original_capital_usdt NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 台股持倉
CREATE TABLE IF NOT EXISTS stock_positions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shares NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    is_margin BOOLEAN DEFAULT FALSE,
    pledge_rate NUMERIC DEFAULT 0,
    loan_amount NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 美股持倉
CREATE TABLE IF NOT EXISTS us_stock_positions (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    shares NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    loan_amount NUMERIC DEFAULT 0,
    is_margin BOOLEAN DEFAULT FALSE,
    margin_ratio NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 幣圈持倉
CREATE TABLE IF NOT EXISTS crypto_positions (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    type TEXT DEFAULT 'spot',
    leverage NUMERIC DEFAULT 1,
    margin NUMERIC DEFAULT 0,
    units NUMERIC DEFAULT 0,
    entry_price NUMERIC DEFAULT 0,
    current_price NUMERIC DEFAULT 0,
    position_size NUMERIC DEFAULT 0,
    pnl NUMERIC DEFAULT 0,
    pnl_percent NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 負債
CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    type TEXT DEFAULT 'other',
    principal NUMERIC DEFAULT 0,
    monthly_payment NUMERIC DEFAULT 0,
    interest_rate NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 每日快照
CREATE TABLE IF NOT EXISTS daily_snapshots (
    id TEXT PRIMARY KEY,
    timestamp BIGINT,
    net_worth NUMERIC DEFAULT 0,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 目標
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_amount NUMERIC DEFAULT 0,
    deadline TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    achieved_at TIMESTAMPTZ
);

-- ============================================
-- Row Level Security (RLS) - 可選
-- 如果需要多用戶，啟用以下 RLS 設定
-- ============================================

-- 暫時關閉 RLS（單用戶模式），以確保資料寫入順暢
-- 如需啟用，請確保有對應的 Auth 系統配合

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_stock_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- 允許匿名用戶完全存取（單用戶模式）
-- 注意：這裡的 "anon" 角色對應 API Key 中的 anon key
CREATE POLICY "Allow all for anon" ON user_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON stock_positions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON us_stock_positions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON crypto_positions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON debts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_snapshots FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON goals FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================
-- 完成！
-- ============================================
SELECT 'Tables created successfully (Full Version)!' as message;
