-- Step 1: Database Schema Updates for WhatsApp Events

CREATE TYPE academic_event_type AS ENUM ('QUIZ', 'EXAM', 'ASSIGNMENT', 'LECTURE_UPDATE');

CREATE TABLE IF NOT EXISTS academic_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type academic_event_type NOT NULL,
    title TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE,
    original_message TEXT,
    is_completed BOOLEAN DEFAULT false,
    reminder_sent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for cron job optimization
CREATE INDEX IF NOT EXISTS idx_academic_events_date ON academic_events(event_date) WHERE is_completed = false;
