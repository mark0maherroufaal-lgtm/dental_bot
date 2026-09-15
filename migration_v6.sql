-- Phase 3 DB Migration: Deep Remediation

-- 1. ERRORS TABLE (Durable Error Registry)
CREATE TABLE IF NOT EXISTS errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id TEXT UNIQUE NOT NULL,
    severity TEXT NOT NULL,
    component TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    user_id TEXT REFERENCES users(telegram_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'OPEN'
);

-- 2. TASKS TABLE UPDATES
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "time" TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "source" TEXT; -- 'SCHEDULE', 'REMINDER', etc.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "source_id" UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP WITH TIME ZONE;

-- 3. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    telegram_id TEXT REFERENCES users(telegram_id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, CLAIMED, SENT, FAILED
    attempt_count INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_status_time ON notifications(status, scheduled_at);

-- 4. COLLEGE SCHEDULE UPDATES
ALTER TABLE college_schedule ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'; -- active, inactive
ALTER TABLE college_schedule ADD COLUMN IF NOT EXISTS "group_name" TEXT DEFAULT 'A3';
ALTER TABLE college_schedule ADD COLUMN IF NOT EXISTS "event_type" TEXT; -- A3, A-block, B-block

-- 5. RPC for idempotent notification claiming
CREATE OR REPLACE FUNCTION claim_due_notifications(max_claims INT)
RETURNS TABLE (id UUID, task_id UUID, telegram_id TEXT, scheduled_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE notifications n
  SET status = 'CLAIMED', attempt_count = attempt_count + 1
  WHERE n.id IN (
    SELECT inner_n.id
    FROM notifications inner_n
    WHERE inner_n.status IN ('PENDING', 'FAILED')
      AND inner_n.scheduled_at <= timezone('utc'::text, now())
      AND inner_n.attempt_count < 3
    ORDER BY inner_n.scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT max_claims
  )
  RETURNING n.id, n.task_id, n.telegram_id, n.scheduled_at;
END;
$$;
