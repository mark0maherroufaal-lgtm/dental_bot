import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";

export interface Task {
    id: string;
    telegram_id: string;
    title: string;
    description?: string;
    category: string;
    priority: string;
    status: string;
    due_date?: string;
    duration_minutes?: number;
    xp_reward: number;
    completed_at?: string;
}

export async function createDailyTasks(telegramId: string, tasks: Partial<Task>[]): Promise<Task[]> {
    try {
        const tasksToInsert = tasks.map(t => ({
            telegram_id: telegramId,
            status: 'pending',
            ...t
        }));
        
        const { data, error } = await supabase.from('tasks').insert(tasksToInsert).select();
        if (error) throw new DatabaseError("Failed to create tasks", error);
        return data as Task[];
    } catch (e: any) {
        console.error(e);
        throw e;
    }
}

export async function getTodaysTasks(telegramId: string, dateStr: string): Promise<Task[]> {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('due_date', dateStr)
            .neq('status', 'cancelled')
            .order('priority', { ascending: false });
            
        if (error) throw new DatabaseError("Failed to get today's tasks", error);
        return data || [];
    } catch (e: any) {
        console.error(e);
        return [];
    }
}

export async function getTasksInRange(telegramId: string, startDate: string, endDate: string): Promise<Task[]> {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('telegram_id', telegramId)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .neq('status', 'cancelled');
            
        if (error) throw new DatabaseError("Failed to get tasks in range", error);
        return data || [];
    } catch (e: any) {
        console.error(e);
        return [];
    }
}

export async function updateTaskStatus(taskId: string, status: string, telegramId: string): Promise<void> {
    try {
        const updateData: any = { status };
        if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }
        
        const { error } = await supabase
            .from('tasks')
            .update(updateData)
            .eq('id', taskId)
            .eq('telegram_id', telegramId);
            
        if (error) throw new DatabaseError("Failed to update task", error);
    } catch (e: any) {
        console.error(e);
        throw e;
    }
}
