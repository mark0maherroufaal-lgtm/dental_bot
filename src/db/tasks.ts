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
    time?: string;
    source?: string;
    source_id?: string;
    duration_minutes?: number;
    xp_reward: number;
    completed_at?: string;
    cancelled_at?: string;
}

export async function createDailyTasks(telegramId: string, tasks: Partial<Task>[]): Promise<Task[]> {
    if (tasks.length === 0) return [];
    try {
        const tasksToInsert = tasks.map(t => ({
            telegram_id: telegramId,
            status: 'pending',
            ...t
        }));
        
        const { data, error } = await supabase.from('tasks').insert(tasksToInsert).select();
        if (error) throw new DatabaseError(error.message, error);
        return data as Task[];
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
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
            
        if (error) throw new DatabaseError(error.message, error);
        return data || [];
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
        throw e;
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
            
        if (error) throw new DatabaseError(error.message, error);
        return data || [];
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
        throw e;
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
            
        if (error) throw new DatabaseError(error.message, error);
    } catch (e: any) {
        if (!(e instanceof DatabaseError)) {
            throw new DatabaseError(e.message, e);
        }
        throw e;
    }
}
