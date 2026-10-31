"use strict";
// src/db/gamification.ts (xp_db.ts)
// Stage 4: XP Gamification Engine, Direct Query Fallback & Daily Study Streak Calculator
Object.defineProperty(exports, "__esModule", { value: true });
exports.addXpTransaction = addXpTransaction;
exports.getTotalXp = getTotalXp;
exports.calculateLevel = calculateLevel;
exports.getActiveStreakDays = getActiveStreakDays;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
const timezone_1 = require("../core/timezone");
async function addXpTransaction(telegramId, amount, reason, taskId) {
    try {
        // Prevent duplicate XP awards for the same taskId if provided
        if (taskId) {
            const { data: existing } = await supabase_1.supabase
                .from("xp_transactions")
                .select("id")
                .eq("telegram_id", telegramId)
                .eq("task_id", taskId)
                .limit(1);
            if (existing && existing.length > 0) {
                return;
            }
        }
        const { error } = await supabase_1.supabase.from("xp_transactions").insert([
            {
                telegram_id: telegramId,
                amount,
                reason,
                task_id: taskId || null
            }
        ]);
        if (error)
            throw new errors_1.DatabaseError("Failed to add XP transaction", error);
    }
    catch (e) {
        console.error("[xp_db] XP Transaction Error:", e);
    }
}
async function getTotalXp(telegramId) {
    try {
        // 1. Try fast RPC first
        const { data, error } = await supabase_1.supabase.rpc("get_total_xp", {
            user_telegram_id: telegramId
        });
        if (!error && typeof data === "number") {
            return data;
        }
        // 2. Automatic Fallback: sum directly from xp_transactions table
        const { data: rows, error: sumErr } = await supabase_1.supabase
            .from("xp_transactions")
            .select("amount")
            .eq("telegram_id", telegramId);
        if (sumErr || !rows)
            return 0;
        return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    }
    catch (e) {
        console.error("[xp_db] getTotalXp error:", e);
        return 0;
    }
}
function calculateLevel(xp) {
    if (xp >= 500)
        return { levelText: "👑 أستاذ (Master)", levelNumber: 5, nextLevelXp: xp };
    if (xp >= 300)
        return { levelText: "🏅 خبير (Expert)", levelNumber: 4, nextLevelXp: 500 };
    if (xp >= 150)
        return { levelText: "🎓 ممارس (Practitioner)", levelNumber: 3, nextLevelXp: 300 };
    if (xp >= 50)
        return { levelText: "🚀 متدرب (Trainee)", levelNumber: 2, nextLevelXp: 150 };
    return { levelText: "🌟 مبتدئ (Beginner)", levelNumber: 1, nextLevelXp: 50 };
}
/**
 * Calculates Dr. Marko's consecutive daily commitment streak (🔥 Streak)
 * based on completed tasks and XP transactions in Africa/Cairo timezone.
 */
async function getActiveStreakDays(telegramId) {
    try {
        const sixtyDaysAgo = (0, timezone_1.addDaysToCairoDate)(-60);
        const [xpRes, completedTasksRes] = await Promise.all([
            supabase_1.supabase
                .from("xp_transactions")
                .select("created_at")
                .eq("telegram_id", telegramId)
                .gte("created_at", `${sixtyDaysAgo}T00:00:00Z`),
            supabase_1.supabase
                .from("tasks")
                .select("completed_at, due_date")
                .eq("telegram_id", telegramId)
                .eq("status", "completed")
                .gte("due_date", sixtyDaysAgo)
        ]);
        const activeDates = new Set();
        for (const row of xpRes.data || []) {
            if (row.created_at) {
                const cairoDate = (0, timezone_1.getCurrentDateStr)(new Date(row.created_at));
                activeDates.add(cairoDate);
            }
        }
        for (const row of completedTasksRes.data || []) {
            if (row.completed_at) {
                const cairoDate = (0, timezone_1.getCurrentDateStr)(new Date(row.completed_at));
                activeDates.add(cairoDate);
            }
            else if (row.due_date) {
                activeDates.add(String(row.due_date));
            }
        }
        if (activeDates.size === 0)
            return 0;
        const todayStr = (0, timezone_1.getCurrentDateStr)();
        const yesterdayStr = (0, timezone_1.addDaysToCairoDate)(-1, todayStr);
        // Streak is active if Dr. Marko completed something today OR yesterday
        let cursorDate = activeDates.has(todayStr)
            ? todayStr
            : activeDates.has(yesterdayStr)
                ? yesterdayStr
                : null;
        if (!cursorDate)
            return 0;
        let streak = 0;
        while (cursorDate && activeDates.has(cursorDate)) {
            streak++;
            cursorDate = (0, timezone_1.addDaysToCairoDate)(-1, cursorDate);
        }
        return streak;
    }
    catch (e) {
        console.error("[xp_db] getActiveStreakDays error:", e);
        return 0;
    }
}
