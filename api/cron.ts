import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";
import { processDueNotifications } from "../src/services/notifications";
import { supabase } from "../src/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        await processDueNotifications();

        const adminId = process.env.ADMIN_TELEGRAM_ID || process.env.ADMIN_ID || "5785296270";

        // --- WhatsApp Academic Reminders Logic ---
        // 1. Fetch events coming up in the next 3 days that are not completed
        const { data: upcomingEvents, error } = await supabase
            .from('academic_events')
            .select('*')
            .eq('is_completed', false)
            .gte('event_date', new Date().toISOString())
            .lte('event_date', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());

        if (upcomingEvents && upcomingEvents.length > 0) {
            for (const event of upcomingEvents) {
                const eventDate = new Date(event.event_date);
                const daysLeft = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 3600 * 24));
                
                const emoji = event.event_type === 'EXAM' ? '⚠️' : event.event_type === 'QUIZ' ? '📝' : '📅';
                const msg = `${emoji} *تذكير أكاديمي هام!*\n\n📌 *الحدث:* ${event.title}\n⏳ *متبقي:* ${daysLeft} أيام\n📅 *الموعد:* ${eventDate.toLocaleDateString('en-EG')}\n\n(المصدر: جروب الدفعة)`;
                
                await bot.api.sendMessage(adminId, msg, { parse_mode: "Markdown" });

                // Increment reminder count
                await supabase.from('academic_events').update({ reminder_sent_count: event.reminder_sent_count + 1 }).eq('id', event.id);
            }
        }

        res.status(200).json({ status: "cron_executed" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: "error" });
    }
}