// src/services/reminders.ts (reminders_service.ts)
// Stage 4 (Updated with Stage 5 Integration): Cairo-Accurate Reminder Service + findNextCourseSession Integration

import { supabase } from "../supabase";
import { createDailyTasks, Task } from "../db/tasks";
import { findNextCourseSession } from "../db/schedule";
import { DatabaseError } from "../core/errors";
import { ParsedReminder } from "../gemini";
import {
    cairoDateTimeToUtcIso,
    formatDateToArabicFriendly,
    formatTimeToArabic12h,
    normalizeTimeStr,
    addDaysToCairoDate
} from "../core/timezone";

/**
 * Strips filler words ("تذكير", "مهمة", "ميعاد", "الـ") so fuzzy search finds the actual task
 * even when the user says "الغي تذكير الكويز" for a task titled "مراجعة الكويز".
 */
function extractSearchKeywords(rawTitle: string): string[] {
    const cleaned = rawTitle
        .replace(/^(?:تذكير|مهمة|مهمه|ميعاد|موعد|مراجعة|مذاكرة|الغي|امسح|أجل|اجل)\s+/gi, "")
        .replace(/\b(?:الـ|ال)(?=\w)/g, "")
        .trim();

    const candidates: string[] = [];
    if (cleaned && cleaned.length >= 2) candidates.push(cleaned);
    if (rawTitle.trim() && !candidates.includes(rawTitle.trim())) {
        candidates.push(rawTitle.trim());
    }

    const words = cleaned
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3);

    for (const w of words) {
        if (!candidates.includes(w)) {
            candidates.push(w);
        }
    }

    return candidates;
}

/**
 * Finds the best matching active task for CANCEL or RESCHEDULE using progressive fuzzy matching
 */
async function findMatchingActiveTask(
    telegramId: string,
    rawSearchTitle: string
): Promise<Task | null> {
    const keywords = extractSearchKeywords(rawSearchTitle);

    for (const kw of keywords) {
        const { data: tasks, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("telegram_id", telegramId)
            .in("status", ["pending", "rescheduled"])
            .ilike("title", `%${kw}%`)
            .order("created_at", { ascending: false })
            .limit(1);

        if (error) {
            throw new DatabaseError("Failed to search task", error);
        }
        if (tasks && tasks.length > 0) {
            return tasks[0] as Task;
        }
    }

    return null;
}

/**
 * Stage 5 Connected Schedule-Aware Helper:
 * Uses `findNextCourseSession` (with DENTAL_COURSE_ALIASES for "أوبرا", "إندو", "فيكسد", etc.)
 * to set the reminder 1 hour before the next matching session!
 */
async function resolveScheduleAwareTiming(
    telegramId: string,
    courseKeyword?: string | null,
    taskTitle?: string
): Promise<{ date: string; time: string } | null> {
    const rawQuery = courseKeyword?.trim() || taskTitle?.trim() || "";
    if (!rawQuery) return null;

    const prefersPractical = /(?:سكشن|عيادة|عملي|section|clinic|lab)/i.test(taskTitle || "");
    const prefersTheoretical = /(?:محاضرة|نظري|lecture)/i.test(taskTitle || "");
    const preferredType = prefersPractical
        ? "Practical"
        : prefersTheoretical
        ? "Theoretical"
        : undefined;

    try {
        const match = await findNextCourseSession(rawQuery, telegramId, preferredType);
        if (!match) return null;

        return {
            date: match.nextDateStr,
            time: match.suggestedReminderTime
        };
    } catch (e) {
        console.warn("[Reminders] findNextCourseSession fallback:", e);
        return null;
    }
}

/**
 * Formats the date + time line in the exact Brief style:
 * e.g., "غداً الساعة 9:00 ص" or "النهارده"
 */
function formatBriefScheduleLine(dateStr: string, timeStr?: string | null): string {
    const friendlyDate = formatDateToArabicFriendly(dateStr);
    const friendlyTime = formatTimeToArabic12h(timeStr);
    return friendlyTime ? `${friendlyDate} الساعة ${friendlyTime}` : friendlyDate;
}

export async function handleReminderAction(
    telegramId: string,
    reminder: ParsedReminder
): Promise<string> {
    // 1. CREATE REMINDER / TASK
    if (reminder.action === "CREATE") {
        let finalDate = reminder.date;
        let finalTime = reminder.time ? normalizeTimeStr(reminder.time) : null;

        // If no explicit time was provided, check if it's linked to a college schedule session via Stage 5's findNextCourseSession
        if (
            !finalTime &&
            (reminder.course_keyword ||
                /(?:قبل\s+سكشن|قبل\s+محاضرة|قبل\s+عيادة|سكشن|محاضرة)/i.test(reminder.task))
        ) {
            const scheduleTiming = await resolveScheduleAwareTiming(
                telegramId,
                reminder.course_keyword,
                reminder.task
            );
            if (scheduleTiming) {
                finalDate = scheduleTiming.date;
                finalTime = normalizeTimeStr(scheduleTiming.time);
            }
        }

        const tasks = await createDailyTasks(telegramId, [
            {
                title: reminder.task,
                due_date: finalDate,
                time: finalTime || undefined,
                category: reminder.category || "REMINDER",
                priority: reminder.priority || "Medium",
                xp_reward: 10,
                source: "USER_REMINDER"
            }
        ]);

        const task = tasks[0];
        if (task && finalTime) {
            const scheduledAtIso = cairoDateTimeToUtcIso(finalDate, finalTime);
            await supabase.from("notifications").insert([
                {
                    task_id: task.id,
                    telegram_id: telegramId,
                    scheduled_at: scheduledAtIso,
                    status: "PENDING"
                }
            ]);
        }

        const scheduleLine = formatBriefScheduleLine(finalDate, finalTime);
        return `✅ تم!\n📌 المهمة: ${reminder.task}\n📅 الميعاد: ${scheduleLine}`;
    }

    // 2. CANCEL OR RESCHEDULE EXISTING TASK
    if (
        reminder.action === "RESCHEDULE" ||
        reminder.action === "EDIT" ||
        reminder.action === "CANCEL"
    ) {
        const targetTask = await findMatchingActiveTask(telegramId, reminder.task);

        if (!targetTask) {
            return `❌ ملقتش مهمة نشطة باسم قريب من "${reminder.task}".`;
        }

        if (reminder.action === "CANCEL") {
            const nowIso = new Date().toISOString();
            await Promise.all([
                supabase
                    .from("tasks")
                    .update({ status: "cancelled", cancelled_at: nowIso })
                    .eq("id", targetTask.id),
                supabase
                    .from("notifications")
                    .update({ status: "CANCELLED" })
                    .eq("task_id", targetTask.id)
                    .eq("status", "PENDING")
            ]);

            return `✅ تم إلغاء التذكير!\n🗑️ المهمة: ${targetTask.title}`;
        }

        // RESCHEDULE / EDIT
        const newDate = reminder.date || targetTask.due_date || addDaysToCairoDate(1);
        const newTime = reminder.time
            ? normalizeTimeStr(reminder.time)
            : targetTask.time || null;

        await supabase
            .from("tasks")
            .update({
                due_date: newDate,
                time: newTime,
                status: "pending"
            })
            .eq("id", targetTask.id);

        // Cancel old pending notifications and insert a new one if time exists
        await supabase
            .from("notifications")
            .update({ status: "CANCELLED" })
            .eq("task_id", targetTask.id)
            .eq("status", "PENDING");

        if (newTime) {
            const scheduledAtIso = cairoDateTimeToUtcIso(newDate, newTime);
            await supabase.from("notifications").insert([
                {
                    task_id: targetTask.id,
                    telegram_id: telegramId,
                    scheduled_at: scheduledAtIso,
                    status: "PENDING"
                }
            ]);
        }

        const scheduleLine = formatBriefScheduleLine(newDate, newTime);
        return `✅ تم!\n📌 المهمة: ${targetTask.title}\n📅 الميعاد: ${scheduleLine}`;
    }

    return "❌ مقدرتش أفهم الإجراء المطلوب للتذكير.";
}