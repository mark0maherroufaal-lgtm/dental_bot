"use strict";
// src/db/tasks.ts (tasks_db.ts)
// Stage 4: Tasks Database Operations, Idempotent XP Completion, Midnight-Safe Snoozing & Notification Sync
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDailyTasks = createDailyTasks;
exports.getTaskById = getTaskById;
exports.getTodaysTasks = getTodaysTasks;
exports.getTasksInRange = getTasksInRange;
exports.updateTaskStatus = updateTaskStatus;
exports.completeTaskWithXp = completeTaskWithXp;
exports.snoozeTaskById = snoozeTaskById;
exports.cancelTaskById = cancelTaskById;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
const timezone_1 = require("../core/timezone");
const gamification_1 = require("./gamification");
const PRIORITY_WEIGHT = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
};
function sortTasksLogically(tasks) {
    return [...tasks].sort((a, b) => {
        // Pending tasks first, completed tasks last
        if (a.status === "completed" && b.status !== "completed")
            return 1;
        if (a.status !== "completed" && b.status === "completed")
            return -1;
        // Tasks with specific time come first in chronological order
        if (a.time && b.time && a.time !== b.time) {
            return a.time.localeCompare(b.time);
        }
        if (a.time && !b.time)
            return -1;
        if (!a.time && b.time)
            return 1;
        // Then by true priority weight (Critical > High > Medium > Low)
        const wA = PRIORITY_WEIGHT[(a.priority || "medium").toLowerCase()] || 2;
        const wB = PRIORITY_WEIGHT[(b.priority || "medium").toLowerCase()] || 2;
        return wB - wA;
    });
}
async function createDailyTasks(telegramId, tasks) {
    if (tasks.length === 0)
        return [];
    try {
        const tasksToInsert = tasks.map((t) => ({
            telegram_id: telegramId,
            status: "pending",
            category: t.category || "REMINDER",
            priority: t.priority || "Medium",
            xp_reward: t.xp_reward ?? 10,
            ...t,
            time: t.time ? (0, timezone_1.normalizeTimeStr)(t.time) : null
        }));
        const { data, error } = await supabase_1.supabase
            .from("tasks")
            .insert(tasksToInsert)
            .select("*");
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        return (data || []);
    }
    catch (e) {
        if (!(e instanceof errors_1.DatabaseError)) {
            throw new errors_1.DatabaseError(e.message, e);
        }
        throw e;
    }
}
async function getTaskById(taskId, telegramId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .eq("telegram_id", telegramId)
            .maybeSingle();
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        return data || null;
    }
    catch (e) {
        console.error("[tasks_db] getTaskById error:", e);
        return null;
    }
}
async function getTodaysTasks(telegramId, dateStr) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("tasks")
            .select("*")
            .eq("telegram_id", telegramId)
            .eq("due_date", dateStr)
            .neq("status", "cancelled");
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        return sortTasksLogically((data || []));
    }
    catch (e) {
        if (!(e instanceof errors_1.DatabaseError)) {
            throw new errors_1.DatabaseError(e.message, e);
        }
        throw e;
    }
}
async function getTasksInRange(telegramId, startDate, endDate) {
    try {
        const { data, error } = await supabase_1.supabase
            .from("tasks")
            .select("*")
            .eq("telegram_id", telegramId)
            .gte("due_date", startDate)
            .lte("due_date", endDate)
            .neq("status", "cancelled");
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        return sortTasksLogically((data || []));
    }
    catch (e) {
        if (!(e instanceof errors_1.DatabaseError)) {
            throw new errors_1.DatabaseError(e.message, e);
        }
        throw e;
    }
}
async function updateTaskStatus(taskId, status, telegramId) {
    try {
        const nowIso = new Date().toISOString();
        const updateData = { status };
        if (status === "completed") {
            updateData.completed_at = nowIso;
        }
        else if (status === "cancelled") {
            updateData.cancelled_at = nowIso;
        }
        const { error } = await supabase_1.supabase
            .from("tasks")
            .update(updateData)
            .eq("id", taskId)
            .eq("telegram_id", telegramId);
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        // If task is completed or cancelled, cancel any pending notifications for it
        if (status === "completed" || status === "cancelled") {
            await supabase_1.supabase
                .from("notifications")
                .update({ status: "CANCELLED" })
                .eq("task_id", taskId)
                .eq("status", "PENDING");
        }
    }
    catch (e) {
        if (!(e instanceof errors_1.DatabaseError)) {
            throw new errors_1.DatabaseError(e.message, e);
        }
        throw e;
    }
}
/**
 * Idempotently marks a task as completed, cancels pending notifications,
 * and awards XP ONLY if the task wasn't already completed (prevents button-spam double XP).
 */
async function completeTaskWithXp(taskId, telegramId) {
    const existing = await getTaskById(taskId, telegramId);
    if (!existing) {
        return { alreadyCompleted: false, task: null, xpAwarded: 0 };
    }
    if (existing.status === "completed") {
        return { alreadyCompleted: true, task: existing, xpAwarded: 0 };
    }
    const xpReward = existing.xp_reward && existing.xp_reward > 0 ? existing.xp_reward : 10;
    await updateTaskStatus(taskId, "completed", telegramId);
    await (0, gamification_1.addXpTransaction)(telegramId, xpReward, `إتمام مهمة: ${existing.title}`, existing.id);
    return {
        alreadyCompleted: false,
        task: { ...existing, status: "completed" },
        xpAwarded: xpReward
    };
}
/**
 * Snoozes a task by 1 hour (automatically rolling over `due_date` to tomorrow if past 11:00 PM Cairo time)
 * or to tomorrow morning, and reschedules its notification in `notifications` table.
 */
async function snoozeTaskById(taskId, telegramId, mode) {
    const existing = await getTaskById(taskId, telegramId);
    if (!existing) {
        return {
            task: null,
            newDate: (0, timezone_1.getCurrentDateStr)(),
            newTime: "09:00:00",
            formattedSchedule: ""
        };
    }
    let newDate;
    let newTime;
    if (mode === "1h") {
        // Add exactly 60 minutes to current timestamp; getCurrentDateStr/TimeStr in Africa/Cairo
        // automatically handles crossing midnight (e.g., 11:30 PM -> tomorrow 00:30 AM)!
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
        newDate = (0, timezone_1.getCurrentDateStr)(oneHourFromNow);
        newTime = (0, timezone_1.getCurrentTimeStr)(oneHourFromNow).slice(0, 5) + ":00";
    }
    else {
        // Snooze to tomorrow at the task's existing time (or 09:00 AM if it had no time)
        newDate = (0, timezone_1.getTomorrowDateStr)();
        newTime = (0, timezone_1.normalizeTimeStr)(existing.time) || "09:00:00";
    }
    // 1. Update the task's due_date, time, and status
    const { error: updateErr } = await supabase_1.supabase
        .from("tasks")
        .update({
        due_date: newDate,
        time: newTime,
        status: "pending"
    })
        .eq("id", taskId)
        .eq("telegram_id", telegramId);
    if (updateErr)
        throw new errors_1.DatabaseError(updateErr.message, updateErr);
    // 2. Cancel old pending notifications for this task
    await supabase_1.supabase
        .from("notifications")
        .update({ status: "CANCELLED" })
        .eq("task_id", taskId)
        .eq("status", "PENDING");
    // 3. Schedule a new PENDING notification with exact Cairo-to-UTC ISO timestamp
    const scheduledAtIso = (0, timezone_1.cairoDateTimeToUtcIso)(newDate, newTime);
    await supabase_1.supabase.from("notifications").insert([
        {
            task_id: taskId,
            telegram_id: telegramId,
            scheduled_at: scheduledAtIso,
            status: "PENDING"
        }
    ]);
    const formattedSchedule = `${(0, timezone_1.formatDateToArabicFriendly)(newDate)} الساعة ${(0, timezone_1.formatTimeToArabic12h)(newTime)}`;
    return {
        task: { ...existing, due_date: newDate, time: newTime, status: "pending" },
        newDate,
        newTime,
        formattedSchedule
    };
}
/**
 * Cancels a task by ID and cancels any pending notifications for it.
 */
async function cancelTaskById(taskId, telegramId) {
    const existing = await getTaskById(taskId, telegramId);
    if (!existing)
        return null;
    await updateTaskStatus(taskId, "cancelled", telegramId);
    return { ...existing, status: "cancelled" };
}
