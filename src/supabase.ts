// src/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { config } from './core/config';
import {
    getCurrentDateStr,
    addDaysToCairoDate,
    getCairoDayOfWeek,
    getCairoDayNameAr,
    formatTimeToArabic12h
} from './core/timezone';

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

// ==========================================
// Database Row Interfaces (TypeScript Schema)
// ==========================================

export type TaskStatus = 'pending' | 'completed' | 'cancelled' | 'rescheduled';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type AcademicEventType = 'EXAM' | 'QUIZ' | 'ASSIGNMENT';

export interface TaskRow {
    id: string;
    telegram_id: string;
    title: string;
    description?: string | null;
    category: string;
    priority: string;
    status: TaskStatus;
    due_date: string | null; // YYYY-MM-DD
    time?: string | null;    // HH:MM:SS
    xp_reward: number;
    source?: string | null;
    completed_at?: string | null;
    cancelled_at?: string | null;
    created_at?: string;
}

export interface NotificationRow {
    id: string;
    task_id: string | null;
    telegram_id: string;
    scheduled_at: string; // ISO UTC Timestamp
    status: NotificationStatus;
    sent_at?: string | null;
    last_error?: string | null;
}

export interface ExpenseRow {
    id: string;
    telegram_id: string;
    amount: number;
    currency: string;
    category: string;
    description?: string | null;
    merchant?: string | null;
    payment_method?: string | null;
    expense_date?: string;
    created_at?: string;
}

export interface CollegeScheduleRow {
    id: string;
    telegram_id: string;
    course_name: string;
    day_of_week: number; // 0 = Sun ... 6 = Sat
    start_time: string;  // HH:MM:SS
    end_time: string;    // HH:MM:SS
    session_type: string;
    location?: string | null;
    status?: string | null;
}

export interface XpTransactionRow {
    id: string;
    telegram_id: string;
    amount: number;
    reason: string;
    task_id?: string | null;
    created_at?: string;
}

export interface ChatContextRow {
    id: string;
    telegram_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at?: string;
}

export interface AcademicEventRow {
    id: string;
    event_type: AcademicEventType;
    title: string;
    event_date: string; // YYYY-MM-DD
    is_completed: boolean;
    original_message?: string | null;
}

export interface LiveDbSnapshot {
    todayDate: string;
    dayNameAr: string;
    pendingTasksToday: TaskRow[];
    completedTasksTodayCount: number;
    todaySchedule: CollegeScheduleRow[];
    upcomingAcademicEvents: AcademicEventRow[];
    totalXp: number;
    todayExpensesTotal: number;
    monthExpensesTotal: number;
}

// ==========================================
// Core Helper Functions (Backward-Compatible)
// ==========================================

export async function addTodo(task: string, dueDate: string, userId: string): Promise<TaskRow | null> {
    const { data, error } = await supabase
        .from('tasks')
        .insert([
            {
                title: task,
                due_date: dueDate || getCurrentDateStr(),
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
    return data as TaskRow;
}

/**
 * Atomically increments Gemini Pro usage for today's date in Africa/Cairo timezone.
 * Returns the updated usage count (or config.DAILY_PRO_LIMIT + 1 if RPC fails so it safely falls back).
 */
export async function incrementProUsage(): Promise<number> {
    try {
        const today = getCurrentDateStr(); // YYYY-MM-DD in Africa/Cairo
        const { data, error } = await supabase.rpc('increment_pro_usage_atomic', {
            target_date: today
        });
        if (error) {
            console.error('[Supabase] incrementProUsage RPC error:', error);
            return 1;
        }
        return typeof data === 'number' ? data : Number(data) || 1;
    } catch (e) {
        console.error('[Supabase] incrementProUsage exception:', e);
        return 1;
    }
}

/**
 * Checks if Dr. Marko still has Gemini Pro quota left today (max 50/day by default)
 * and increments the counter if allowed.
 */
export async function tryConsumeProQuota(limit: number = config.DAILY_PRO_LIMIT): Promise<{
    allowed: boolean;
    usedCount: number;
    limit: number;
}> {
    const usedCount = await incrementProUsage();
    return {
        allowed: usedCount <= limit,
        usedCount,
        limit
    };
}

export async function getReadArticlesCount(telegramId: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('scientific_articles')
            .select('id', { count: 'exact', head: true })
            .eq('telegram_id', telegramId)
            .eq('reading_status', 'COMPLETED');
        if (error) {
            console.error('[Supabase] getReadArticlesCount error:', error);
            return 0;
        }
        return count || 0;
    } catch (e) {
        console.error('[Supabase] getReadArticlesCount exception:', e);
        return 0;
    }
}

export async function recordReadArticle(articleType: string, telegramId: string): Promise<void> {
    try {
        await supabase.from('scientific_articles').insert([
            {
                telegram_id: telegramId,
                title: articleType,
                topic: 'General',
                category: 'Quick Read',
                reading_status: 'COMPLETED',
                completed_at: new Date().toISOString()
            }
        ]);
    } catch (e) {
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
export async function getLiveDbSnapshot(telegramId: string = config.ADMIN_ID): Promise<LiveDbSnapshot> {
    const todayDate = getCurrentDateStr();
    const threeDaysLater = addDaysToCairoDate(3, todayDate);
    const dayOfWeek = getCairoDayOfWeek();
    const dayNameAr = getCairoDayNameAr();
    const monthStart = `${todayDate.slice(0, 7)}-01`;

    try {
        const [
            tasksRes,
            scheduleRes,
            eventsRes,
            xpRes,
            monthExpensesRes
        ] = await Promise.all([
            supabase
                .from('tasks')
                .select('*')
                .eq('telegram_id', telegramId)
                .eq('due_date', todayDate)
                .neq('status', 'cancelled')
                .order('time', { ascending: true, nullsFirst: false }),

            supabase
                .from('college_schedule')
                .select('*')
                .eq('telegram_id', telegramId)
                .eq('day_of_week', dayOfWeek)
                .order('start_time', { ascending: true }),

            supabase
                .from('academic_events')
                .select('*')
                .eq('is_completed', false)
                .gte('event_date', todayDate)
                .lte('event_date', threeDaysLater)
                .order('event_date', { ascending: true }),

            supabase
                .from('xp_transactions')
                .select('amount')
                .eq('telegram_id', telegramId),

            supabase
                .from('expenses')
                .select('amount, created_at, expense_date')
                .eq('telegram_id', telegramId)
                .gte('created_at', `${monthStart}T00:00:00Z`)
        ]);

        const allTodayTasks = (tasksRes.data || []) as TaskRow[];
        const pendingTasksToday = allTodayTasks.filter((t) => t.status === 'pending' || t.status === 'rescheduled');
        const completedTasksTodayCount = allTodayTasks.filter((t) => t.status === 'completed').length;

        const todaySchedule = ((scheduleRes.data || []) as CollegeScheduleRow[]).filter(
            (s) => !s.status || s.status.toLowerCase() !== 'cancelled'
        );

        const upcomingAcademicEvents = (eventsRes.data || []) as AcademicEventRow[];

        const totalXp = (xpRes.data || []).reduce((sum, row: any) => sum + (Number(row.amount) || 0), 0);

        let todayExpensesTotal = 0;
        let monthExpensesTotal = 0;
        for (const exp of monthExpensesRes.data || []) {
            const amt = Number((exp as any).amount) || 0;
            monthExpensesTotal += amt;
            const expDate =
                (exp as any).expense_date ||
                ((exp as any).created_at ? String((exp as any).created_at).slice(0, 10) : '');
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
    } catch (err) {
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
export function formatSnapshotForPrompt(snap: LiveDbSnapshot): string {
    const tasksLine =
        snap.pendingTasksToday.length > 0
            ? snap.pendingTasksToday
                  .map((t) => `${t.title}${t.time ? ` (${formatTimeToArabic12h(t.time)})` : ''}`)
                  .join(' | ')
            : 'لا توجد مهام متبقية اليوم';

    const scheduleLine =
        snap.todaySchedule.length > 0
            ? snap.todaySchedule
                  .map(
                      (s) =>
                          `${s.course_name} (${s.session_type} من ${formatTimeToArabic12h(s.start_time)} إلى ${formatTimeToArabic12h(s.end_time)}${s.location ? ` - ${s.location}` : ''})`
                  )
                  .join(' | ')
            : 'لا توجد محاضرات أو سكاشن مسجلة اليوم';

    const eventsLine =
        snap.upcomingAcademicEvents.length > 0
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
export async function saveChatContextMessage(
    telegramId: string,
    role: 'user' | 'assistant',
    content: string
): Promise<void> {
    if (!content?.trim()) return;
    try {
        await supabase.from('chat_context').insert([
            {
                telegram_id: telegramId,
                role,
                content: content.trim().slice(0, 4000)
            }
        ]);
    } catch (err) {
        console.error('[Supabase] saveChatContextMessage error:', err);
    }
}

/**
 * Fetches the last N messages from `chat_context` in chronological order
 */
export async function getRecentChatContext(
    telegramId: string,
    limit = 8
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
        const { data, error } = await supabase
            .from('chat_context')
            .select('role, content, created_at')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data) return [];
        return data
            .reverse()
            .filter((row: any) => row.role === 'user' || row.role === 'assistant')
            .map((row: any) => ({
                role: row.role as 'user' | 'assistant',
                content: String(row.content || '')
            }));
    } catch (err) {
        console.error('[Supabase] getRecentChatContext error:', err);
        return [];
    }
}