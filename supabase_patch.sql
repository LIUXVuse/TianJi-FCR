-- ============================================
-- Supabase 資料表結構補丁 (Patch v1)
-- 修復台股和負債欄位缺失問題
-- ============================================

-- 1. 更新 stock_positions (台股)
ALTER TABLE stock_positions 
ADD COLUMN IF NOT EXISTS pledge_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_amount NUMERIC DEFAULT 0;

-- 移除不再使用的欄位 (可選)
-- ALTER TABLE stock_positions DROP COLUMN IF EXISTS margin_ratio;

-- 2. 更新 debts (負債)
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS principal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_payment NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;

-- 3. 檢查 us_stock_positions (美股)
-- 確保欄位存在
ALTER TABLE us_stock_positions
ADD COLUMN IF NOT EXISTS loan_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_margin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS margin_ratio NUMERIC DEFAULT 0;

-- ============================================
-- 完成！
-- ============================================
SELECT 'Schema updated successfully!' as message;
