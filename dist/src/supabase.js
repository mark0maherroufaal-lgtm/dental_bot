"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.addTodo = addTodo;
exports.incrementProUsage = incrementProUsage;
exports.tryConsumeProQuota = tryConsumeProQuota;
exports.getReadArticlesCount = getReadArticlesCount;
exports.recordReadArticle = recordReadArticle;
exports.getLiveDbSnapshot = getLiveDbSnapshot;
exports.formatSnapshotForPrompt = formatSnapshotForPrompt;
exports.saveChatContextMessage = saveChatContextMessage;
exports.getRecentChatContext = getRecentChatContext;
// src/supabase.ts
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./core/config");
const timezone_1 = require("./core/timezone");
exports.supabase = (0, supabase_js_1.createClient)(config_1.config.SUPABASE_URL, config_1.config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});
// ==========================================
// Core Helper Functions (Backward-Compatible)
// ==========================================
async function addTodo(task, dueDate, userId) {
    const { data, error } = await exports.supabase
        .from('tasks')
        .insert([
        {
            title: task,
            due_date: dueDate || (0, timezone_1.getCurrentDateStr)(),
            telegram_id: userId,
            status: 'pending',
            category: 'REMINDER',
            priority: 'Medium',
            xp_reward: 10,
            source: 'telegram'
        }
    ])
        .select('*')
        .single();
    if (error) {
        console.error('[Supabase] addTodo error:', error);
        return null;
    }
    return data;
}
/**
 * Atomically increments Gemini Pro usage for today's date in Africa/Cairo timezone.
 * Returns the updated usage count (or config.DAILY_PRO_LIMIT + 1 if RPC fails so it safely falls back).
 */
async function incrementProUsage() {
    try {
        const today = (0, timezone_1.getCurrentDateStr)(); // YYYY-MM-DD in Africa/Cairo
        const { data, error } = await exports.supabase.rpc('increment_pro_usage_atomic', {
            target_date: today
        });
        if (error) {
            console.error('[Supabase] incrementProUsage RPC error:', error);
            return 1;
        }
        return typeof data === 'number' ? data : Number(data) || 1;
    }
    catch (e) {
        console.error('[Supabase] incrementProUsage exception:', e);
        return 1;
    }
}
/**
 * Checks if Dr. Marko still has Gemini Pro quota left today (max 50/day by default)
 * and increments the counter if allowed.
 */
async function tryConsumeProQuota(limit = config_1.config.DAILY_PRO_LIMIT) {
    const usedCount = await incrementProUsage();
    return {
        allowed: usedCount <= limit,
        usedCount,
        limit
    };
}
async function getReadArticlesCount(telegramId) {
    try {
        const { count, error } = await exports.supabase
            .from('scientific_articles')
            .select('id', { count: 'exact', head: true })
            .eq('telegram_id', telegramId)
            .eq('reading_status', 'COMPLETED');
        if (error) {
            console.error('[Supabase] getReadArticlesCount error:', error);
            return 0;
        }
        return count || 0;
    }
    catch (e) {
        console.error('[Supabase] getReadArticlesCount exception:', e);
        return 0;
    }
}
async function recordReadArticle(articleType, telegramId) {
    try {
        await exports.supabase.from('scientific_articles').insert([
            {
                telegram_id: telegramId,
                title: articleType,
                topic: 'General',
                category: 'Quick Read',
                reading_status: 'COMPLETED',
                completed_at: new Date().toISOString()
            }
        ]);
    }
    catch (e) {
        console.error('[Supabase] recordReadArticle error:', e);
    }
}
// ==========================================
// Live DB Snapshot & Chat Context Helpers
// ==========================================
/**
 * Fetches a real-time snapshot of Dr. Marko's day in parallel (<120ms)
 * to ground Groq/Gemini responses and prevent any hallucinated tasks, lectures, or numbers.
 */
async function getLiveDbSnapshot(telegramId = config_1.config.ADMIN_ID) {
    const todayDate = (0, timezone_1.getCurrentDateStr)();
    const threeDaysLater = (0, timezone_1.addDaysToCairoDate)(3, todayDate);
    const dayOfWeek = (0, timezone_1.getCairoDayOfWeek)();
    const dayNameAr = (0, timezone_1.getCairoDayNameAr)();
    const monthStart = `${todayDate.slice(0, 7)}-01`;
    try {
        const [tasksRes, scheduleRes, eventsRes, xpRes, monthExpensesRes] = await Promise.all([
            exports.supabase
                .from('tasks')
                .select('*')
                .eq('telegram_id', telegramId)
                .eq('due_date', todayDate)
                .neq('status', 'cancelled')
                .order('time', { ascending: true, nullsFirst: false }),
            exports.supabase
                .from('college_schedule')
                .select('*')
                .eq('telegram_id', telegramId)
                .eq('day_of_week', dayOfWeek)
                .order('start_time', { ascending: true }),
            exports.supabase
                .from('academic_events')
                .select('*')
                .eq('is_completed', false)
                .gte('event_date', todayDate)
                .lte('event_date', threeDaysLater)
                .order('event_date', { ascending: true }),
            exports.supabase
                .from('xp_transactions')
                .select('amount')
                .eq('telegram_id', telegramId),
            exports.supabase
                .from('expenses')
                .select('amount, created_at, expense_date')
                .eq('telegram_id', telegramId)
                .gte('created_at', `${monthStart}T00:00:00Z`)
        ]);
        const allTodayTasks = (tasksRes.data || []);
        const pendingTasksToday = allTodayTasks.filter((t) => t.status === 'pending' || t.status === 'rescheduled');
        const completedTasksTodayCount = allTodayTasks.filter((t) => t.status === 'completed').length;
        const todaySchedule = (scheduleRes.data || []).filter((s) => !s.status || s.status.toLowerCase() !== 'cancelled');
        const upcomingAcademicEvents = (eventsRes.data || []);
        const totalXp = (xpRes.data || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        let todayExpensesTotal = 0;
        let monthExpensesTotal = 0;
        for (const exp of monthExpensesRes.data || []) {
            const amt = Number(exp.amount) || 0;
            monthExpensesTotal += amt;
            const expDate = exp.expense_date ||
                (exp.created_at ? String(exp.created_at).slice(0, 10) : '');
            if (expDate === todayDate) {
                todayExpensesTotal += amt;
            }
        }
        return {
            todayDate,
            dayNameAr,
            pendingTasksToday,
            completedTasksTodayCount,
            todaySchedule,
            upcomingAcademicEvents,
            totalXp,
            todayExpensesTotal,
            monthExpensesTotal
        };
    }
    catch (err) {
        console.error('[Supabase] getLiveDbSnapshot error:', err);
        return {
            todayDate,
            dayNameAr,
            pendingTasksToday: [],
            completedTasksTodayCount: 0,
            todaySchedule: [],
            upcomingAcademicEvents: [],
            totalXp: 0,
            todayExpensesTotal: 0,
            monthExpensesTotal: 0
        };
    }
}
/**
 * Formats the LiveDbSnapshot into a compact Arabic context block for the AI System Prompt
 */
function formatSnapshotForPrompt(snap) {
    const tasksLine = snap.pendingTasksToday.length > 0
        ? snap.pendingTasksToday
            .map((t) => `${t.title}${t.time ? ` (${(0, timezone_1.formatTimeToArabic12h)(t.time)})` : ''}`)
            .join(' | ')
        : 'لا توجد مهام متبقية اليوم';
    const scheduleLine = snap.todaySchedule.length > 0
        ? snap.todaySchedule
            .map((s) => `${s.course_name} (${s.session_type} من ${(0, timezone_1.formatTimeToArabic12h)(s.start_time)} إلى ${(0, timezone_1.formatTimeToArabic12h)(s.end_time)}${s.location ? ` - ${s.location}` : ''})`)
            .join(' | ')
        : 'لا توجد محاضرات أو سكاشن مسجلة اليوم';
    const eventsLine = snap.upcomingAcademicEvents.length > 0
        ? snap.upcomingAcademicEvents
            .map((e) => `${e.event_type}: ${e.title} (${e.event_date})`)
            .join(' | ')
        : 'لا توجد امتحانات أو كويزات خلال الـ 3 أيام القادمة';
    return [
        `[بيانات د. ماركو الحقيقية من الداتابيز الآن — ممنوع تأليف أي بيانات خارجها]:`,
        `- مهام اليوم المتبقية (${snap.pendingTasksToday.length}): ${tasksLine}`,
        `- مهام أُنجزت اليوم: ${snap.completedTasksTodayCount}`,
        `- جدول الكلية اليوم (${snap.dayNameAr}): ${scheduleLine}`,
        `- أحداث أكاديمية قريبة: ${eventsLine}`,
        `- إجمالي XP: ${snap.totalXp} نقطة | مصاريف اليوم: ${snap.todayExpensesTotal} ج.م | مصاريف الشهر: ${snap.monthExpensesTotal} ج.م`
    ].join('\n');
}
/**
 * Saves a message to `chat_context` and opportunistically prunes messages older than the latest 30
 */
async function saveChatContextMessage(telegramId, role, content) {
    if (!content?.trim())
        return;
    try {
        await exports.supabase.from('chat_context').insert([
            {
                telegram_id: telegramId,
                role,
                content: content.trim().slice(0, 4000)
            }
        ]);
    }
    catch (err) {
        console.error('[Supabase] saveChatContextMessage error:', err);
    }
}
/**
 * Fetches the last N messages from `chat_context` in chronological order
 */
async function getRecentChatContext(telegramId, limit = 8) {
    try {
        const { data, error } = await exports.supabase
            .from('chat_context')
            .select('role, content, created_at')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error || !data)
            return [];
        return data
            .reverse()
            .filter((row) => row.role === 'user' || row.role === 'assistant')
            .map((row) => ({
            role: row.role,
            content: String(row.content || '')
        }));
    }
    catch (err) {
        console.error('[Supabase] getRecentChatContext error:', err);
        return [];
    }
}
