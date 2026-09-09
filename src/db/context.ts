import { supabase } from "../supabase";

export async function addChatContext(telegramId: string, role: 'user' | 'model', content: string) {
    try {
        await supabase.from('chat_context').insert([{
            telegram_id: telegramId,
            role,
            content
        }]);
    } catch (e) {
        console.error("Failed to add chat context", e);
    }
}

export async function getChatContext(telegramId: string, limit: number = 8): Promise<{role: string, content: string}[]> {
    try {
        const { data, error } = await supabase
            .from('chat_context')
            .select('role, content')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(limit);
            
        if (error) return [];
        // Return in chronological order
        return data.reverse();
    } catch (e) {
        return [];
    }
}
