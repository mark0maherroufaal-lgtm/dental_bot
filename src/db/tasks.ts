// src/db/tasks.ts (tasks_db.ts)
// Stage 4: Tasks Database Operations, Idempotent XP Completion, Midnight-Safe Snoozing & Notification Sync

import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";
import {
    getCurrentDateStr,
    getCurrentTimeStr,
    getTomorrowDateStr,
    normalizeTimeStr,
    cairoDateTimeToUtcIso,
    formatDateToArabicFriendly,
    formatTimeToArabic12h
} from "../core/timezone";
import { addXpTransaction } from "./gamification";

export interface Task {
    id: string;
    telegram_id: string;
    title: string;
    description?: string;
    category: string;
    priority: string;
    status: string;
    due_date?: string;
    time?: string | null;
    source?: string;
    source_id?: string;
    duration_minutes?: number;
    xp_reward: number;
    completed_at?: string | null;
    cancelled_at?: string | null;
}

const PRIORITY_WEIGHT: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
};

function sortTasksLogically(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
        // Pending tasks first, completed tasks last
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (a.status !== "completed" && b.status === "completed") return -1;

        // Tasks with specific time come first in chronological order
        if (a.time && b.time && a.time !== b.time) {
            return a.time.localeCompare(b.time);
        }
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;

        // Then by true priority weight (Critical > High > Medium > Low)
        const wA = PRIORITY_WEIGHT[(a.priority || "medium").toLowerCase()] || 2;
        const wB = PRIORITY_WEIGHT[(b.priority || "medium").toLowerCase()] || 2;
        return wB - wA;
    });
}

export async function createDailyTasks(
    telegramId: string,
    tasks: Partial<Task>[]
): Promise<Task[]> {
    if (tasks.length === 0) return [];
    try {
        const tasksToInsert = tasks.map((t) => ({
            telegram_id: telegramId,
            status: "pending",
            category: t.category || "REMINDER",
            priority: t.priority || "Medium",
            xp_reward: t.xp_reward ?? 10,
            ...t,
            time: t.time ? normalizeTimeStr(t.time) : null
        }));

        const { data, error } = await supabase
            .from("tasks")
            .insert(tasksToInsert)
            .select("*");
        if (error) throw new DatabaseError(error.message, error);
        return (data || []) as Task[];
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
        throw e;
    }
}

export async function getTaskById(
    taskId: string,
    telegramId: string
): Promise<Task | null> {
    try {
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("id", taskId)
            .eq("telegram_id", telegramId)
            .maybeSingle();

        if (error) throw new DatabaseError(error.message, error);
        return (data as Task) || null;
    } catch (e) {
        console.error("[tasks_db] getTaskById error:", e);
        return null;
    }
}

export async function getTodaysTasks(
    telegramId: string,
    dateStr: string
): Promise<Task[]> {
    try {
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("telegram_id", telegramId)
            .eq("due_date", dateStr)
            .neq("status", "cancelled");

        if (error) throw new DatabaseError(error.message, error);
        return sortTasksLogically((data || []) as Task[]);
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
        throw e;
    }
}

export async function getTasksInRange(
    telegramId: string,
    startDate: string,
    endDate: string
): Promise<Task[]> {
    try {
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("telegram_id", telegramId)
            .gte("due_date", startDate)
            .lte("due_date", endDate)
            .neq("status", "cancelled");

        if (error) throw new DatabaseError(error.message, error);
        return sortTasksLogically((data || []) as Task[]);
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
        throw e;
    }
}

export async function updateTaskStatus(
    taskId: string,
    status: string,
    telegramId: string
): Promise<void> {
    try {
        const nowIso = new Date().toISOString();
        const updateData: Record<string, any> = { status };

        if (status === "completed") {
            updateData.completed_at = nowIso;
        } else if (status === "cancelled") {
            updateData.cancelled_at = nowIso;
        }

        const { error } = await supabase
            .from("tasks")
            .update(updateData)
            .eq("id", taskId)
            .eq("telegram_id", telegramId);

        if (error) throw new DatabaseError(error.message, error);

        // If task is completed or cancelled, cancel any pending notifications for it
        if (status === "completed" || status === "cancelled") {
            await supabase
                .from("notifications")
                .update({ status: "CANCELLED" })
                .eq("task_id", taskId)
                .eq("status", "PENDING");
        }
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
        throw e;
    }
}

/**
 * Idempotently marks a task as completed, cancels pending notifications,
 * and awards XP ONLY if the task wasn't already completed (prevents button-spam double XP).
 */
export async function completeTaskWithXp(
    taskId: string,
    telegramId: string
): Promise<{
    alreadyCompleted: boolean;
    task: Task | null;
    xpAwarded: number;
}> {
    const existing = await getTaskById(taskId, telegramId);
    if (!existing) {
        return { alreadyCompleted: false, task: null, xpAwarded: 0 };
    }

    if (existing.status === "completed") {
        return { alreadyCompleted: true, task: existing, xpAwarded: 0 };
    }

    const xpReward = existing.xp_reward && existing.xp_reward > 0 ? existing.xp_reward : 10;

    await updateTaskStatus(taskId, "completed", telegramId);
    await addXpTransaction(
        telegramId,
        xpReward,
        `إتمام مهمة: ${existing.title}`,
        existing.id
    );

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
export async function snoozeTaskById(
    taskId: string,
    telegramId: string,
    mode: "1h" | "tomorrow"
): Promise<{
    task: Task | null;
    newDate: string;
    newTime: string;
    formattedSchedule: string;
}> {
    const existing = await getTaskById(taskId, telegramId);
    if (!existing) {
        return {
            task: null,
            newDate: getCurrentDateStr(),
            newTime: "09:00:00",
            formattedSchedule: ""
        };
    }

    let newDate: string;
    let newTime: string;

    if (mode === "1h") {
        // Add exactly 60 minutes to current timestamp; getCurrentDateStr/TimeStr in Africa/Cairo
        // automatically handles crossing midnight (e.g., 11:30 PM -> tomorrow 00:30 AM)!
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
        newDate = getCurrentDateStr(oneHourFromNow);
        newTime = getCurrentTimeStr(oneHourFromNow).slice(0, 5) + ":00";
    } else {
        // Snooze to tomorrow at the task's existing time (or 09:00 AM if it had no time)
        newDate = getTomorrowDateStr();
        newTime = normalizeTimeStr(existing.time) || "09:00:00";
    }

    // 1. Update the task's due_date, time, and status
    const { error: updateErr } = await supabase
        .from("tasks")
        .update({
            due_date: newDate,
            time: newTime,
            status: "pending"
        })
        .eq("id", taskId)
        .eq("telegram_id", telegramId);

    if (updateErr) throw new DatabaseError(updateErr.message, updateErr);

    // 2. Cancel old pending notifications for this task
    await supabase
        .from("notifications")
        .update({ status: "CANCELLED" })
        .eq("task_id", taskId)
        .eq("status", "PENDING");

    // 3. Schedule a new PENDING notification with exact Cairo-to-UTC ISO timestamp
    const scheduledAtIso = cairoDateTimeToUtcIso(newDate, newTime);
    await supabase.from("notifications").insert([
        {
            task_id: taskId,
            telegram_id: telegramId,
            scheduled_at: scheduledAtIso,
            status: "PENDING"
        }
    ]);

    const formattedSchedule = `${formatDateToArabicFriendly(newDate)} الساعة ${formatTimeToArabic12h(newTime)}`;

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
export async function cancelTaskById(
    taskId: string,
    telegramId: string
): Promise<Task | null> {
    const existing = await getTaskById(taskId, telegramId);
    if (!existing) return null;

    await updateTaskStatus(taskId, "cancelled", telegramId);
    return { ...existing, status: "cancelled" };
}