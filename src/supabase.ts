import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function addTodo(task: string, dueDate: string, userId: string) {
    await supabase.from('todos').insert([{ title: task, due_date: dueDate, user_id: userId, status: 'open' }]);
}

// 🚀 [جديد] دالة لجلب مهام المستخدم للإحصائيات
export async function getUserTodos(userId: string) {
    try {
        // جلب المهام المفتوحة (التي لم تكتمل بعد) مرتبة حسب التاريخ
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'open')
            .order('due_date', { ascending: true })
            .limit(30); // جلب أقرب 30 مهمة كحد أقصى لتجنب إرهاق الذكاء الاصطناعي
            
        return data || [];
    } catch (e) {
        console.error("Error fetching todos", e);
        return [];
    }
}

export async function isUpdateProcessed(updateId: number): Promise<boolean> {
    try {
        const { data } = await supabase.from('processed_updates').select('update_id').eq('update_id', updateId).single();
        return !!data;
    } catch {
        return false;
    }
}

export async function markUpdateProcessed(updateId: number) {
    try {
        await supabase.from('processed_updates').insert([{ update_id: updateId }]);
    } catch (e) {
        console.error("Failed to mark update", e);
    }
}
