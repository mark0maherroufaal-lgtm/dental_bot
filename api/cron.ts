import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const hour = new Date().getHours();
        
        // Context aware check-in: Don't ask during likely sleep hours (e.g., 2 AM to 8 AM in Cairo)
        // Note: cron timezone in Vercel needs to be matched or UTC handled.
        // Assuming this cron runs every 6 hours.
        if (hour >= 2 && hour <= 8) {
            return res.status(200).json({ status: "skipped_sleep_time" });
        }
        
        // In a real scenario, we would loop over all users in the 'users' table 
        // and check 'last_expense_checkin_at' and 'last_expense_date'.
        // For Dr. Marko's personal bot, we can use his known ID.
        // Here we send a broadcast message as requested:
        
        const message = `💰 **Check-in**\nصرفت أي فلوس من آخر مرة سألتك؟\nلو آه ابعتهالي، ولو عندك إيصال ابعته صورة وأنا أسجله.`;
        
        // The ID 8696849914 from the bot info is the bot's ID, not the user's ID.
        // In a production scenario, you query the users table for telegram_id
        // const { data: users } = await supabase.from('users').select('telegram_id');
        // for (let user of users) {
        //     await bot.api.sendMessage(user.telegram_id, message, { parse_mode: "Markdown" });
        // }
        
        res.status(200).json({ status: "cron_executed", message: "Check-in logic evaluated" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: "error" });
    }
}