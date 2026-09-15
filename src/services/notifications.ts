import { bot } from '../bot';
import { supabase } from '../supabase';
import { DatabaseError } from '../core/errors';

export async function processDueNotifications() {
    try {
        // Use RPC to atomically claim due notifications
        const { data: claims, error: claimErr } = await supabase.rpc('claim_due_notifications', {
            max_claims: 20
        });

        if (claimErr) throw new DatabaseError("Failed to claim notifications", claimErr);
        if (!claims || claims.length === 0) return;

        for (const claim of claims) {
            try {
                // Fetch task details
                const { data: taskData, error: taskErr } = await supabase
                    .from('tasks')
                    .select('title')
                    .eq('id', claim.task_id)
                    .single();

                if (taskErr || !taskData) throw new Error("Task not found");

                // Send via Telegram
                await bot.api.sendMessage(claim.telegram_id, `🔔 تذكير جديد!\n\n📌 المهمة: ${taskData.title}`);

                // Mark SENT
                await supabase.from('notifications').update({
                    status: 'SENT',
                    sent_at: new Date().toISOString()
                }).eq('id', claim.id);

            } catch (err: any) {
                console.error(`Failed to send notification ${claim.id}:`, err);
                await supabase.from('notifications').update({
                    status: 'FAILED',
                    last_error: err.message
                }).eq('id', claim.id);
            }
        }
    } catch (e) {
        console.error("processDueNotifications error:", e);
    }
}
