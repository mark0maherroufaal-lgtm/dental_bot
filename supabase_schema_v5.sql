-- SQL for Chat Context
CREATE TABLE IF NOT EXISTS chat_context (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'model'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
