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

export async function tryMarkUpdateProcessed(updateId: number): Promise<boolean> {
    try {
        const { error } = await supabase.from('processed_updates').insert([{ update_id: updateId }]);
        if (error) {
            // Postgres unique_violation code is '23505'
            if (error.code === '23505') {
                return false; // Already processed
            }
            console.error("Failed to mark update", error);
            // On other errors, we might want to return true to still process it, or false to skip. Let's return true to fallback gracefully.
            return true; 
        }
        return true; // Successfully marked
    } catch (e) {
        console.error("Error in tryMarkUpdateProcessed", e);
        return true;
    }
}

// 🚀 [جديد] عداد الباقة الذكي لموديل Pro
export async function incrementProUsage(): Promise<number> {
    try {
        const today = new Date().toISOString().split('T')[0]; // صيغة YYYY-MM-DD
        
        // ⚡ Performance & Security Fix: Use atomic RPC function
        const { data, error } = await supabase.rpc('increment_pro_usage_atomic', { target_date: today });
        
        if (error) {
            console.error("RPC Usage Tracking Error:", error);
            return 0;
        }
        
        return data as number;
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

export async function getReadArticlesCount(userId: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from("read_articles")
            .select('*', { count: 'exact', head: true })
            .eq("user_id", userId);
            
        if (error) {
            console.error("Error fetching articles count:", error);
            return 0;
        }
        return count || 0;
    } catch (e) {
        console.error("Error in getReadArticlesCount:", e);
        return 0;
    }
}
