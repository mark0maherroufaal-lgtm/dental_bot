-- =======================================================
-- Dr. Marko Dental Bot - Supabase DB Updates & RPCs
-- قم بنسخ هذا الكود بالكامل ولصقه في SQL Editor الخاص بـ Supabase ثم اضغط Run
-- =======================================================

-- 1. إنشاء جدول تتبع استهلاك باقة الذكاء الاصطناعي (إذا لم يكن موجوداً)
CREATE TABLE IF NOT EXISTS api_usage (
    date DATE PRIMARY KEY,
    pro_requests INT DEFAULT 0
);

-- 2. إنشاء جدول حماية الـ Webhook من التكرار (Idempotency) (إذا لم يكن موجوداً)
CREATE TABLE IF NOT EXISTS processed_updates (
    update_id BIGINT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =======================================================
-- دوال قاعدة البيانات (RPC - Remote Procedure Calls)
-- =======================================================

-- 3. دالة لحساب إجمالي النقاط (XP) بلمح البصر في الداتابيز لتوفير الذاكرة (Performance Fix)
CREATE OR REPLACE FUNCTION get_total_xp(user_telegram_id TEXT) 
RETURNS integer AS $$
DECLARE
    total integer;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total 
    FROM xp_transactions 
    WHERE telegram_id = user_telegram_id;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 4. دالة لزيادة عداد استهلاك الباقة بشكل ذري وآمن لمنع ضياع البيانات (Race Condition Fix)
CREATE OR REPLACE FUNCTION increment_pro_usage_atomic(target_date DATE) 
RETURNS integer AS $$
DECLARE
    new_count integer;
BEGIN
    INSERT INTO api_usage (date, pro_requests)
    VALUES (target_date, 1)
    ON CONFLICT (date) DO UPDATE 
    SET pro_requests = api_usage.pro_requests + 1
    RETURNING pro_requests INTO new_count;
    
    RETURN new_count;
END;
$$ LANGUAGE plpgsql;
