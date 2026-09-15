"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReminderAction = handleReminderAction;
const supabase_1 = require("../supabase");
const tasks_1 = require("../db/tasks");
const errors_1 = require("../core/errors");
async function handleReminderAction(telegramId, reminder) {
    if (reminder.action === "CREATE") {
        const tasks = await (0, tasks_1.createDailyTasks)(telegramId, [{
                title: reminder.task,
                due_date: reminder.date,
                time: reminder.time || undefined,
                category: 'REMINDER',
                priority: 'Medium',
                xp_reward: 10,
                source: 'USER_REMINDER'
            }]);
        const task = tasks[0];
        if (task && reminder.time) {
            // Schedule notification
            const scheduledAt = new Date(`${reminder.date}T${reminder.time}:00+02:00`); // Assuming Egypt timezone
            await supabase_1.supabase.from('notifications').insert([{
                    task_id: task.id,
                    telegram_id: telegramId,
                    scheduled_at: scheduledAt.toISOString(),
                    status: 'PENDING'
                }]);
        }
        return `✅ تم جدولة التذكير بنجاح!\n📌 المهمة: ${reminder.task}\n📅 التاريخ: ${reminder.date}${reminder.time ? `\n⏰ الوقت: ${reminder.time}` : ''}`;
    }
    if (reminder.action === "RESCHEDULE" || reminder.action === "CANCEL") {
        // Find existing task
        const { data: tasks, error } = await supabase_1.supabase
            .from('tasks')
            .select('*')
            .eq('telegram_id', telegramId)
            .neq('status', 'cancelled')
            .ilike('title', `%${reminder.task}%`)
            .order('created_at', { ascending: false })
            .limit(1);
        if (error)
            throw new errors_1.DatabaseError("Failed to find task for rescheduling", error);
        if (!tasks || tasks.length === 0) {
            return `❌ لم أتمكن من العثور على مهمة باسم مقارب لـ "${reminder.task}" لتعديلها.`;
        }
        const targetTask = tasks[0];
        if (reminder.action === "CANCEL") {
            await supabase_1.supabase.from('tasks').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', targetTask.id);
            await supabase_1.supabase.from('notifications').update({ status: 'CANCELLED' }).eq('task_id', targetTask.id);
            return `🗑️ تم إلغاء مهمة: ${targetTask.title}`;
        }
        if (reminder.action === "RESCHEDULE") {
            await supabase_1.supabase.from('tasks').update({
                due_date: reminder.date,
                time: reminder.time || null
            }).eq('id', targetTask.id);
            // Delete old notifications and create new if time exists
            await supabase_1.supabase.from('notifications').update({ status: 'CANCELLED' }).eq('task_id', targetTask.id);
            if (reminder.time) {
                const scheduledAt = new Date(`${reminder.date}T${reminder.time}:00+02:00`);
                await supabase_1.supabase.from('notifications').insert([{
                        task_id: targetTask.id,
                        telegram_id: telegramId,
                        scheduled_at: scheduledAt.toISOString(),
                        status: 'PENDING'
                    }]);
            }
            return `🔄 تم تعديل الموعد بنجاح!\n📌 المهمة: ${targetTask.title}\n📅 الموعد الجديد: ${reminder.date}${reminder.time ? `\n⏰ الوقت الجديد: ${reminder.time}` : ''}`;
        }
    }
    return "❌ لم يتم فهم الإجراء المطلوب.";
}
