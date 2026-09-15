"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.addTodo = addTodo;
exports.incrementProUsage = incrementProUsage;
exports.getReadArticlesCount = getReadArticlesCount;
exports.recordReadArticle = recordReadArticle;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./core/config");
exports.supabase = (0, supabase_js_1.createClient)(config_1.config.SUPABASE_URL, config_1.config.SUPABASE_SERVICE_ROLE_KEY);
async function addTodo(task, dueDate, userId) {
    // BUG-010 FIX: Insert into 'tasks' table (the canonical task table) instead of non-existent 'todos'
    await exports.supabase.from('tasks').insert([{
            title: task,
            due_date: dueDate,
            telegram_id: userId,
            status: 'pending',
            category: 'REMINDER',
            priority: 'Medium',
            xp_reward: 10
        }]);
}
async function incrementProUsage() {
    // BUG-005 FIX: Use the existing atomic RPC to increment and return the count
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const { data, error } = await exports.supabase.rpc('increment_pro_usage_atomic', {
            target_date: today
        });
        if (error) {
            console.error('incrementProUsage error:', error);
            return 1;
        }
        return data;
    }
    catch (e) {
        console.error('incrementProUsage exception:', e);
        return 1;
    }
}
async function getReadArticlesCount(telegramId) {
    // BUG-006 FIX: Query the scientific_articles table for completed reads
    try {
        const { count, error } = await exports.supabase
            .from('scientific_articles')
            .select('id', { count: 'exact', head: true })
            .eq('telegram_id', telegramId)
            .eq('reading_status', 'COMPLETED');
        if (error) {
            console.error('getReadArticlesCount error:', error);
            return 0;
        }
        return count || 0;
    }
    catch (e) {
        console.error('getReadArticlesCount exception:', e);
        return 0;
    }
}
async function recordReadArticle(articleType, telegramId) {
    // BUG-007 FIX: Record the article read activity in the database
    try {
        await exports.supabase.from('scientific_articles').insert([{
                telegram_id: telegramId,
                title: articleType,
                topic: 'General',
                category: 'Quick Read',
                reading_status: 'COMPLETED',
                completed_at: new Date().toISOString()
            }]);
    }
    catch (e) {
        console.error('recordReadArticle error:', e);
    }
}
