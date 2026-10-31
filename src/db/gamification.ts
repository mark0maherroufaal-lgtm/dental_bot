// src/db/gamification.ts (xp_db.ts)
// Stage 4: XP Gamification Engine, Direct Query Fallback & Daily Study Streak Calculator

import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";
import { getCurrentDateStr, addDaysToCairoDate } from "../core/timezone";

export async function addXpTransaction(
    telegramId: string,
    amount: number,
    reason: string,
    taskId?: string
): Promise<void> {
    try {
        // Prevent duplicate XP awards for the same taskId if provided
        if (taskId) {
            const { data: existing } = await supabase
                .from("xp_transactions")
                .select("id")
                .eq("telegram_id", telegramId)
                .eq("task_id", taskId)
                .limit(1);

            if (existing && existing.length > 0) {
                return;
            }
        }

        const { error } = await supabase.from("xp_transactions").insert([
            {
                telegram_id: telegramId,
                amount,
                reason,
                task_id: taskId || null
            }
        ]);

        if (error) throw new DatabaseError("Failed to add XP transaction", error);
    } catch (e: any) {
        console.error("[xp_db] XP Transaction Error:", e);
    }
}

export async function getTotalXp(telegramId: string): Promise<number> {
    try {
        // 1. Try fast RPC first
        const { data, error } = await supabase.rpc("get_total_xp", {
            user_telegram_id: telegramId
        });

        if (!error && typeof data === "number") {
            return data;
        }

        // 2. Automatic Fallback: sum directly from xp_transactions table
        const { data: rows, error: sumErr } = await supabase
            .from("xp_transactions")
            .select("amount")
            .eq("telegram_id", telegramId);

        if (sumErr || !rows) return 0;

        return rows.reduce((sum, row: any) => sum + (Number(row.amount) || 0), 0);
    } catch (e: any) {
        console.error("[xp_db] getTotalXp error:", e);
        return 0;
    }
}

export function calculateLevel(xp: number): {
    levelText: string;
    levelNumber: number;
    nextLevelXp: number;
} {
    if (xp >= 500) return { levelText: "👑 أستاذ (Master)", levelNumber: 5, nextLevelXp: xp };
    if (xp >= 300) return { levelText: "🏅 خبير (Expert)", levelNumber: 4, nextLevelXp: 500 };
    if (xp >= 150) return { levelText: "🎓 ممارس (Practitioner)", levelNumber: 3, nextLevelXp: 300 };
    if (xp >= 50) return { levelText: "🚀 متدرب (Trainee)", levelNumber: 2, nextLevelXp: 150 };
    return { levelText: "🌟 مبتدئ (Beginner)", levelNumber: 1, nextLevelXp: 50 };
}

/**
 * Calculates Dr. Marko's consecutive daily commitment streak (🔥 Streak)
 * based on completed tasks and XP transactions in Africa/Cairo timezone.
 */
export async function getActiveStreakDays(telegramId: string): Promise<number> {
    try {
        const sixtyDaysAgo = addDaysToCairoDate(-60);

        const [xpRes, completedTasksRes] = await Promise.all([
            supabase
                .from("xp_transactions")
                .select("created_at")
                .eq("telegram_id", telegramId)
                .gte("created_at", `${sixtyDaysAgo}T00:00:00Z`),
            supabase
                .from("tasks")
                .select("completed_at, due_date")
                .eq("telegram_id", telegramId)
                .eq("status", "completed")
                .gte("due_date", sixtyDaysAgo)
        ]);

        const activeDates = new Set<string>();

        for (const row of xpRes.data || []) {
            if ((row as any).created_at) {
                const cairoDate = getCurrentDateStr(new Date((row as any).created_at));
                activeDates.add(cairoDate);
            }
        }

        for (const row of completedTasksRes.data || []) {
            if ((row as any).completed_at) {
                const cairoDate = getCurrentDateStr(new Date((row as any).completed_at));
                activeDates.add(cairoDate);
            } else if ((row as any).due_date) {
                activeDates.add(String((row as any).due_date));
            }
        }

        if (activeDates.size === 0) return 0;

        const todayStr = getCurrentDateStr();
        const yesterdayStr = addDaysToCairoDate(-1, todayStr);

        // Streak is active if Dr. Marko completed something today OR yesterday
        let cursorDate = activeDates.has(todayStr)
            ? todayStr
            : activeDates.has(yesterdayStr)
            ? yesterdayStr
            : null;

        if (!cursorDate) return 0;

        let streak = 0;
        while (cursorDate && activeDates.has(cursorDate)) {
            streak++;
            cursorDate = addDaysToCairoDate(-1, cursorDate);
        }

        return streak;
    } catch (e) {
        console.error("[xp_db] getActiveStreakDays error:", e);
        return 0;
    }
}