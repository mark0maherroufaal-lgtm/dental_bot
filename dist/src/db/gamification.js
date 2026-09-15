"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addXpTransaction = addXpTransaction;
exports.getTotalXp = getTotalXp;
exports.calculateLevel = calculateLevel;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
async function addXpTransaction(telegramId, amount, reason, taskId) {
    try {
        const { error } = await supabase_1.supabase.from('xp_transactions').insert([{
                telegram_id: telegramId,
                amount,
                reason,
                task_id: taskId || null
            }]);
        if (error)
            throw new errors_1.DatabaseError("Failed to add XP transaction", error);
    }
    catch (e) {
        console.error("XP Transaction Error:", e);
    }
}
async function getTotalXp(telegramId) {
    try {
        // ⚡ Performance Fix: Using RPC to calculate total XP directly in DB
        const { data, error } = await supabase_1.supabase.rpc('get_total_xp', { user_telegram_id: telegramId });
        if (error)
            throw new errors_1.DatabaseError("Failed to fetch XP", error);
        return data;
    }
    catch (e) {
        console.error(e);
        return 0;
    }
}
function calculateLevel(xp) {
    if (xp >= 500)
        return { levelText: "👑 أستاذ (Master)", levelNumber: 5, nextLevelXp: xp };
    if (xp >= 300)
        return { levelText: "🏅 خبير (Expert)", levelNumber: 4, nextLevelXp: 500 };
    if (xp >= 150)
        return { levelText: "🎓 ممارس (Practitioner)", levelNumber: 3, nextLevelXp: 300 };
    if (xp >= 50)
        return { levelText: "🚀 متدرب (Trainee)", levelNumber: 2, nextLevelXp: 150 };
    return { levelText: "🌟 مبتدئ (Beginner)", levelNumber: 1, nextLevelXp: 50 };
}
