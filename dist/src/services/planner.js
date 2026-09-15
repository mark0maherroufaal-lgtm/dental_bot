"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTodaysTasks = ensureTodaysTasks;
exports.completeTask = completeTask;
const tasks_1 = require("../db/tasks");
const timezone_1 = require("../core/timezone");
const gamification_1 = require("../db/gamification");
const schedule_1 = require("../db/schedule");
const DEFAULT_CORE_HABITS = [
    { title: "📖 قراءة الكتاب المقدس (Bible)", category: "CORE_HABIT", priority: "High", xp_reward: 25 },
    { title: "🇬🇧 تدريب إنجليزي (English)", category: "CORE_HABIT", priority: "High", xp_reward: 25 },
    { title: "📚 مذاكرة أكاديمية (Study)", category: "COLLEGE_STUDY", priority: "Medium", xp_reward: 40 }
];
async function ensureTodaysTasks(telegramId) {
    const todayStr = (0, timezone_1.getCurrentDateStr)();
    let tasks = await (0, tasks_1.getTodaysTasks)(telegramId, todayStr);
    const existingTitles = new Set(tasks.map(t => t.title));
    const existingSourceIds = new Set(tasks.filter(t => t.source_id).map(t => t.source_id));
    const coreTasks = [];
    // Initialize core habits if they don't exist
    for (const habit of DEFAULT_CORE_HABITS) {
        if (!existingTitles.has(habit.title)) {
            coreTasks.push({ ...habit, due_date: todayStr });
        }
    }
    const now = new Date();
    const todayDayOfWeek = now.getDay();
    const tomorrowDayOfWeek = (todayDayOfWeek + 1) % 7;
    // --- GOLDEN RULE 1: Lecture Today -> Review Today ---
    const todaySchedule = await (0, schedule_1.getScheduleForDay)(telegramId, todayDayOfWeek);
    for (const session of todaySchedule) {
        if (session.session_type === 'Theoretical' && session.id && !existingSourceIds.has(session.id)) {
            coreTasks.push({
                title: `📚 مراجعة محاضرة: ${session.course_name}`,
                category: "COLLEGE_STUDY",
                priority: "High",
                xp_reward: 40,
                due_date: todayStr,
                source: 'SCHEDULE_REVIEW',
                source_id: session.id
            });
        }
    }
    // --- GOLDEN RULE 2: Clinic/Lab Tomorrow -> Prepare Today ---
    const tomorrowSchedule = await (0, schedule_1.getScheduleForDay)(telegramId, tomorrowDayOfWeek);
    for (const session of tomorrowSchedule) {
        if (session.session_type === 'Practical' && session.id && !existingSourceIds.has(session.id)) {
            coreTasks.push({
                title: `🦷 تدريب استباقي / تحضير لسكشن: ${session.course_name}`,
                category: "PRACTICAL_TRAINING",
                priority: "High",
                xp_reward: 50,
                due_date: todayStr,
                source: 'SCHEDULE_PREPARE',
                source_id: session.id
            });
        }
    }
    if (coreTasks.length > 0) {
        const newTasks = await (0, tasks_1.createDailyTasks)(telegramId, coreTasks);
        tasks = [...tasks, ...newTasks];
    }
    return tasks;
}
async function completeTask(telegramId, taskId) {
    const today = (0, timezone_1.getCurrentDateStr)();
    const tasks = await (0, tasks_1.getTodaysTasks)(telegramId, today);
    const task = tasks.find(t => t.id === taskId);
    if (!task)
        return "المهمة غير موجودة.";
    if (task.status === 'completed')
        return "المهمة مكتملة بالفعل.";
    // 1. Mark as completed
    await (0, tasks_1.updateTaskStatus)(taskId, 'completed', telegramId);
    // 2. Grant XP
    if (task.xp_reward > 0) {
        await (0, gamification_1.addXpTransaction)(telegramId, task.xp_reward, `أكملت: ${task.title}`, taskId);
    }
    return `🎉 عظيم! أتممت مهمة "${task.title}" وكسبت +${task.xp_reward} XP!`;
}
