"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDueNotifications = processDueNotifications;
const bot_1 = require("../bot");
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
async function processDueNotifications() {
    try {
        // Use RPC to atomically claim due notifications
        const { data: claims, error: claimErr } = await supabase_1.supabase.rpc('claim_due_notifications', {
            max_claims: 20
        });
        if (claimErr)
            throw new errors_1.DatabaseError("Failed to claim notifications", claimErr);
        if (!claims || claims.length === 0)
            return;
        for (const claim of claims) {
            try {
                // Fetch task details
                const { data: taskData, error: taskErr } = await supabase_1.supabase
                    .from('tasks')
                    .select('title')
                    .eq('id', claim.task_id)
                    .single();
                if (taskErr || !taskData)
                    throw new Error("Task not found");
                // Send via Telegram
                await bot_1.bot.api.sendMessage(claim.telegram_id, `🔔 تذكير جديد!\n\n📌 المهمة: ${taskData.title}`);
                // Mark SENT
                await supabase_1.supabase.from('notifications').update({
                    status: 'SENT',
                    sent_at: new Date().toISOString()
                }).eq('id', claim.id);
            }
            catch (err) {
                console.error(`Failed to send notification ${claim.id}:`, err);
                await supabase_1.supabase.from('notifications').update({
                    status: 'FAILED',
                    last_error: err.message
                }).eq('id', claim.id);
            }
        }
    }
    catch (e) {
        console.error("processDueNotifications error:", e);
    }
}
