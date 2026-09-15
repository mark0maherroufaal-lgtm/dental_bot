"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addChatContext = addChatContext;
exports.getChatContext = getChatContext;
const supabase_1 = require("../supabase");
async function addChatContext(telegramId, role, content) {
    try {
        await supabase_1.supabase.from('chat_context').insert([{
                telegram_id: telegramId,
                role,
                content
            }]);
    }
    catch (e) {
        console.error("Failed to add chat context", e);
    }
}
async function getChatContext(telegramId, limit = 8) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('chat_context')
            .select('role, content')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            return [];
        // Return in chronological order
        return data.reverse();
    }
    catch (e) {
        return [];
    }
}
