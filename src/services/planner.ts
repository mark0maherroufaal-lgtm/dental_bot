import { createDailyTasks, getTodaysTasks, Task, updateTaskStatus } from "../db/tasks";
import { getCurrentDateStr } from "../core/timezone";
import { addXpTransaction } from "../db/gamification";
import { getScheduleForDay } from "../db/schedule";

const DEFAULT_CORE_HABITS = [
    { title: "📖 قراءة الكتاب المقدس (Bible)", category: "CORE_HABIT", priority: "High", xp_reward: 25 },
    { title: "🇬🇧 تدريب إنجليزي (English)", category: "CORE_HABIT", priority: "High", xp_reward: 25 },
    { title: "📚 مذاكرة أكاديمية (Study)", category: "COLLEGE_STUDY", priority: "Medium", xp_reward: 40 }
];

export async function ensureTodaysTasks(telegramId: string): Promise<Task[]> {
    const todayStr = getCurrentDateStr();
    let tasks = await getTodaysTasks(telegramId, todayStr);
    
    // If no tasks exist for today, initialize them
    if (tasks.length === 0) {
        const coreTasks: Partial<Task>[] = DEFAULT_CORE_HABITS.map(h => ({ ...h, due_date: todayStr }));
        
        // --- Clinical Engine: Tomorrow Preparation ---
        // Find tomorrow's schedule
        const now = new Date();
        const tomorrowDayOfWeek = (now.getDay() + 1) % 7;
        const tomorrowSchedule = await getScheduleForDay(telegramId, tomorrowDayOfWeek);
        
        let practicalAdded = false;
        
        for (const session of tomorrowSchedule) {
            if (session.session_type === 'Practical') {
                coreTasks.push({
                    title: `🦷 تدريب استباقي: ${session.course_name} (تحضير لسكشن بكرة)`,
                    category: "PRACTICAL_TRAINING",
                    priority: "High",
                    xp_reward: 50,
                    due_date: todayStr
                });
                practicalAdded = true;
            }
        }
        
        // If no practical session tomorrow, add a generic practical task
        if (!practicalAdded) {
            coreTasks.push({
                title: "🦷 تدريب عملي (Practical)",
                category: "PRACTICAL_TRAINING",
                priority: "Medium",
                xp_reward: 40,
                due_date: todayStr
            });
        }
        // ---------------------------------------------
        
        tasks = await createDailyTasks(telegramId, coreTasks);
    }
    
    return tasks;
}


export async function completeTask(telegramId: string, taskId: string): Promise<string> {
    const today = getCurrentDateStr();
    const tasks = await getTodaysTasks(telegramId, today);
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return "المهمة غير موجودة.";
    if (task.status === 'completed') return "المهمة مكتملة بالفعل.";
    
    // 1. Mark as completed
    await updateTaskStatus(taskId, 'completed', telegramId);
    
    // 2. Grant XP
    if (task.xp_reward > 0) {
        await addXpTransaction(telegramId, task.xp_reward, `أكملت: ${task.title}`, taskId);
    }
    
    return `🎉 عظيم! أتممت مهمة "${task.title}" وكسبت +${task.xp_reward} XP!`;
}
