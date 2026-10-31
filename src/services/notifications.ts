// src/services/notifications.ts (notifications_service.ts)
// Stage 4: Real-Time Due Notifications Processor with Direct Query Fallback & Interactive Buttons

import { bot } from "../bot";
import { supabase } from "../supabase";
import { formatTimeToArabic12h } from "../core/timezone";

interface DueNotificationClaim {
    id: string;
    task_id: string | null;
    telegram_id: string;
    scheduled_at: string;
}

/**
 * Fetches due notifications using the atomic RPC if available,
 * or falls back seamlessly to a direct query on `notifications` where status='PENDING' and scheduled_at <= now().
 */
async function fetchDueNotificationClaims(maxClaims = 20): Promise<DueNotificationClaim[]> {
    try {
        const { data: claims, error: claimErr } = await supabase.rpc(
            "claim_due_notifications",
            { max_claims: maxClaims }
        );

        if (!claimErr && Array.isArray(claims)) {
            return claims as DueNotificationClaim[];
        }
    } catch (rpcErr) {
        console.warn("[Notifications] RPC claim_due_notifications unavailable, using direct query fallback.");
    }

    // Fallback: Direct query on notifications table
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from("notifications")
        .select("id, task_id, telegram_id, scheduled_at")
        .eq("status", "PENDING")
        .lte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true })
        .limit(maxClaims);

    if (error || !data) {
        if (error) console.error("[Notifications] Direct query error:", error);
        return [];
    }

    return data as DueNotificationClaim[];
}

export function buildReminderInlineKeyboard(taskId: string, xpReward = 10) {
    return {
        inline_keyboard: [
            [
                {
                    text: `✅ خلصت (+${xpReward} XP)`,
                    callback_data: `tdo_${taskId}`
                },
                {
                    text: "⏰ أجل ساعة",
                    callback_data: `snz1h_${taskId}`
                }
            ],
            [
                {
                    text: "📅 لبكره",
                    callback_data: `snz1d_${taskId}`
                },
                {
                    text: "❌ إلغاء",
                    callback_data: `cancel_${taskId}`
                }
            ]
        ]
    };
}

export async function processDueNotifications(): Promise<{
    processed: number;
    sent: number;
    failed: number;
}> {
    let sent = 0;
    let failed = 0;

    try {
        const claims = await fetchDueNotificationClaims(20);
        if (!claims || claims.length === 0) {
            return { processed: 0, sent: 0, failed: 0 };
        }

        for (const claim of claims) {
            try {
                if (!claim.task_id) {
                    await supabase
                        .from("notifications")
                        .update({ status: "CANCELLED" })
                        .eq("id", claim.id);
                    continue;
                }

                // Fetch task details (skip if task was already completed or cancelled)
                const { data: taskData, error: taskErr } = await supabase
                    .from("tasks")
                    .select("id, title, time, status, xp_reward")
                    .eq("id", claim.task_id)
                    .maybeSingle();

                if (taskErr || !taskData) {
                    throw new Error("Task not found");
                }

                if (taskData.status === "completed" || taskData.status === "cancelled") {
                    await supabase
                        .from("notifications")
                        .update({ status: "CANCELLED" })
                        .eq("id", claim.id);
                    continue;
                }

                const timeLabel = taskData.time
                    ? `\n🕒 الميعاد: الساعة ${formatTimeToArabic12h(taskData.time)}`
                    : "";
                const xpReward = taskData.xp_reward || 10;

                const messageText = `🔔 **تذكير يا دكتور ماركو!**\n\n📌 المهمة: ${taskData.title}${timeLabel}`;

                // Send via Telegram with interactive action buttons
                await bot.api.sendMessage(claim.telegram_id, messageText, {
                    parse_mode: "Markdown",
                    reply_markup: buildReminderInlineKeyboard(taskData.id, xpReward)
                });

                // Mark SENT
                await supabase
                    .from("notifications")
                    .update({
                        status: "SENT",
                        sent_at: new Date().toISOString()
                    })
                    .eq("id", claim.id);

                sent++;
            } catch (err: any) {
                failed++;
                console.error(`[Notifications] Failed to send notification ${claim.id}:`, err);
                await supabase
                    .from("notifications")
                    .update({
                        status: "FAILED",
                        last_error: String(err?.message || err).slice(0, 500)
                    })
                    .eq("id", claim.id);
            }
        }

        return { processed: claims.length, sent, failed };
    } catch (e) {
        console.error("[Notifications] processDueNotifications error:", e);
        return { processed: 0, sent, failed };
    }
}