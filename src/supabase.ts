import { createClient } from '@supabase/supabase-js';
import { config } from './core/config';

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

export async function addTodo(task: string, dueDate: string, userId: string) {
    // BUG-010 FIX: Insert into 'tasks' table (the canonical task table) instead of non-existent 'todos'
    await supabase.from('tasks').insert([{
        title: task,
        due_date: dueDate,
        telegram_id: userId,
        status: 'pending',
        category: 'REMINDER',
        priority: 'Medium',
        xp_reward: 10
    }]);
}

export async function incrementProUsage(): Promise<number> {
    // BUG-005 FIX: Use the existing atomic RPC to increment and return the count
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const { data, error } = await supabase.rpc('increment_pro_usage_atomic', {
            target_date: today
        });
        if (error) {
            console.error('incrementProUsage error:', error);
            return 1;
        }
        return data as number;
    } catch (e) {
        console.error('incrementProUsage exception:', e);
        return 1;
    }
}

export async function getReadArticlesCount(telegramId: string): Promise<number> {
    // BUG-006 FIX: Query the scientific_articles table for completed reads
    try {
        const { count, error } = await supabase
            .from('scientific_articles')
            .select('id', { count: 'exact', head: true })
            .eq('telegram_id', telegramId)
            .eq('reading_status', 'COMPLETED');
        if (error) {
            console.error('getReadArticlesCount error:', error);
            return 0;
        }
        return count || 0;
    } catch (e) {
        console.error('getReadArticlesCount exception:', e);
        return 0;
    }
}

export async function recordReadArticle(articleType: string, telegramId: string) {
    // BUG-007 FIX: Record the article read activity in the database
    try {
        await supabase.from('scientific_articles').insert([{
            telegram_id: telegramId,
            title: articleType,
            topic: 'General',
            category: 'Quick Read',
            reading_status: 'COMPLETED',
            completed_at: new Date().toISOString()
        }]);
    } catch (e) {
        console.error('recordReadArticle error:', e);
    }
}
