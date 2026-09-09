import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";

export async function addXpTransaction(telegramId: string, amount: number, reason: string, taskId?: string) {
    try {
        const { error } = await supabase.from('xp_transactions').insert([{
            telegram_id: telegramId,
            amount,
            reason,
            task_id: taskId || null
        }]);
        
        if (error) throw new DatabaseError("Failed to add XP transaction", error);
    } catch (e: any) {
        console.error("XP Transaction Error:", e);
    }
}

export async function getTotalXp(telegramId: string): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('xp_transactions')
            .select('amount')
            .eq('telegram_id', telegramId);
            
        if (error) throw new DatabaseError("Failed to fetch XP", error);
        
        return data.reduce((sum, tx) => sum + tx.amount, 0);
    } catch (e: any) {
        console.error(e);
        return 0;
    }
}

export function calculateLevel(xp: number): { levelText: string, levelNumber: number, nextLevelXp: number } {
    if (xp >= 500) return { levelText: "👑 أستاذ (Master)", levelNumber: 5, nextLevelXp: xp };
    if (xp >= 300) return { levelText: "🏅 خبير (Expert)", levelNumber: 4, nextLevelXp: 500 };
    if (xp >= 150) return { levelText: "🎓 ممارس (Practitioner)", levelNumber: 3, nextLevelXp: 300 };
    if (xp >= 50) return { levelText: "🚀 متدرب (Trainee)", levelNumber: 2, nextLevelXp: 150 };
    return { levelText: "🌟 مبتدئ (Beginner)", levelNumber: 1, nextLevelXp: 50 };
}
