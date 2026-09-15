"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDailyTasks = createDailyTasks;
exports.getTodaysTasks = getTodaysTasks;
exports.getTasksInRange = getTasksInRange;
exports.updateTaskStatus = updateTaskStatus;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
async function createDailyTasks(telegramId, tasks) {
    if (tasks.length === 0)
        return [];
    try {
        const tasksToInsert = tasks.map(t => ({
            telegram_id: telegramId,
            status: 'pending',
            ...t
        }));
        const { data, error } = await supabase_1.supabase.from('tasks').insert(tasksToInsert).select();
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        return data;
    }
    catch (e) {
        if (!(e instanceof errors_1.DatabaseError)) {
            throw new errors_1.DatabaseError(e.message, e);
        }
        throw e;
    }
}
async function getTodaysTasks(telegramId, dateStr) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('tasks')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('due_date', dateStr)
            .neq('status', 'cancelled')
            .order('priority', { ascending: false });
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        return data || [];
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
            .from('tasks')
            .select('*')
            .eq('telegram_id', telegramId)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .neq('status', 'cancelled');
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
        return data || [];
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
        const updateData = { status };
        if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }
        const { error } = await supabase_1.supabase
            .from('tasks')
            .update(updateData)
            .eq('id', taskId)
            .eq('telegram_id', telegramId);
        if (error)
            throw new errors_1.DatabaseError(error.message, error);
    }
    catch (e) {
        if (!(e instanceof errors_1.DatabaseError)) {
            throw new errors_1.DatabaseError(e.message, e);
        }
        throw e;
    }
}
