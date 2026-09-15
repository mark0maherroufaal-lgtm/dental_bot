-- DR MARKO LIFE OS - V4 DATABASE SCHEMA UPDATE

-- 1. Scientific Articles Library
CREATE TABLE IF NOT EXISTS scientific_articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT,
    url TEXT,
    doi TEXT,
    topic TEXT,
    category TEXT,
    reading_status TEXT DEFAULT 'SENT', -- SENT, OPENED, READING, COMPLETED, SKIPPED
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    opened_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    xp_awarded INTEGER DEFAULT 0,
    rating INTEGER,
    notes TEXT,
    clinical_takeaway TEXT
);

-- 2. Images Memory
CREATE TABLE IF NOT EXISTS image_memory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    image_type TEXT, -- Receipt, Clinical Image, X-ray, Graph, Document
    findings TEXT,
    clinical_learning_point TEXT,
    related_article_id UUID REFERENCES scientific_articles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Modify tasks table if needed for Daily Score
-- No structural changes needed for tasks right now.
