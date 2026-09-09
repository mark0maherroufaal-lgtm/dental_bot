import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function addTodo(task: string, dueDate: string, userId: string) {
    await supabase.from('todos').insert([{ title: task, due_date: dueDate, user_id: userId, status: 'open' }]);
}

export async function incrementProUsage(): Promise<number> {
    return 1;
}

export async function getReadArticlesCount(telegramId: string): Promise<number> {
    return 0; // Dummy
}

export async function recordReadArticle(telegramId: string, articleId: string) {
    // Dummy
}
