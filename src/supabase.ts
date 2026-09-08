import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function addTodo(task: string, dueDate: string, userId: string) {
    await supabase.from('todos').insert([{ title: task, due_date: dueDate, user_id: userId, status: 'open' }]);
}

export async function getUserTodos(userId: string) {
    try {
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'open')
            .order('due_date', { ascending: true })
            .limit(30); 
            
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

// 🚀 [جديد] عداد الباقة الذكي لموديل Pro
export async function incrementProUsage(): Promise<number> {
    try {
        const today = new Date().toISOString().split('T')[0]; // صيغة YYYY-MM-DD
        
        let { data, error } = await supabase
            .from('api_usage')
            .select('pro_requests')
            .eq('date', today)
            .single();
            
        if (!data) {
            // أول رسالة اليوم
            await supabase.from('api_usage').insert([{ date: today, pro_requests: 1 }]);
            return 1;
        } else {
            // زيادة العداد
            const newCount = data.pro_requests + 1;
            await supabase.from('api_usage').update({ pro_requests: newCount }).eq('date', today);
            return newCount;
        }
    } catch (e) {
        console.error("Usage Tracking Error:", e);
        return 0; // في حالة الخطأ، نمررها برقم 0 لكي لا يتعطل البوت
    }
}

export async function recordReadArticle(title: string, userId: string) {
    const { data, error } = await supabase
        .from("read_articles")
        .insert([{ user_id: userId, title }]);
    
    if (error) {
        console.error("Error inserting article:", error);
    }
    return data;
}
