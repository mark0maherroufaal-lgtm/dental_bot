-- ==========================================
-- Dr. Marko Life OS v3.0 - Supabase Schema
-- ==========================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    name TEXT,
    username TEXT,
    language TEXT DEFAULT 'ar',
    timezone TEXT DEFAULT 'Africa/Cairo',
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. MEMORIES TABLE (Cognitive Engine)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT REFERENCES users(telegram_id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL, -- e.g., 'Preferred Study Time', 'Wake Time'
    memory_value TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    source TEXT DEFAULT 'chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TASKS TABLE (Planning Engine)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT REFERENCES users(telegram_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- CORE_HABIT, COLLEGE_STUDY, PRACTICAL_TRAINING, etc.
    priority TEXT NOT NULL DEFAULT 'Medium', -- Critical, High, Medium, Low
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, cancelled, rescheduled
    due_date DATE,
    duration_minutes INT,
    xp_reward INT DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. XP TRANSACTIONS (Gamification Engine)
CREATE TABLE IF NOT EXISTS xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT REFERENCES users(telegram_id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason TEXT NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. EXPENSES (Financial Engine)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT REFERENCES users(telegram_id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'EGP',
    category TEXT NOT NULL,
    subcategory TEXT,
    description TEXT,
    merchant TEXT,
    payment_method TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expense_time TIME,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. COLLEGE SCHEDULE (Clinical Engine)
CREATE TABLE IF NOT EXISTS college_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT REFERENCES users(telegram_id) ON DELETE CASCADE,
    course_name TEXT NOT NULL,
    day_of_week INT NOT NULL, -- 0 = Sunday, 1 = Monday, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    session_type TEXT NOT NULL, -- Theoretical, Practical
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. NOTION SYNC STATE (External Sync Engine)
CREATE TABLE IF NOT EXISTS sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT REFERENCES users(telegram_id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- e.g., 'Task', 'Expense'
    entity_id UUID NOT NULL, -- ID in Supabase
    notion_page_id TEXT,
    status TEXT DEFAULT 'PENDING', -- SYNCED, PENDING, FAILED
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (entity_type, entity_id)
);
