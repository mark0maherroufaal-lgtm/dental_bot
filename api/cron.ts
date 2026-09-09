import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Get current hour in Cairo timezone
        const cairoTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
        const hour = new Date(cairoTime).getHours();
        
        // Context aware check-in: Don't ask during likely sleep hours (e.g., 2 AM to 8 AM in Cairo)
        if (hour >= 2 && hour <= 8) {
            return res.status(200).json({ status: "skipped_sleep_time" });
        }
        
        const message = `💰 **Check-in**\nصرفت أي فلوس من آخر مرة سألتك؟\nلو آه ابعتهالي، ولو عندك إيصال ابعته صورة وأنا أسجله.`;
        
        // Since this is a personal bot, we send it to the admin telegram id if provided via env
        const adminId = process.env.ADMIN_TELEGRAM_ID;
        if (adminId) {
             await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
        } else {
             console.warn("ADMIN_TELEGRAM_ID not set. Cron skipped sending.");
        }
        
        res.status(200).json({ status: "cron_executed", message: "Check-in logic evaluated" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: "error" });
    }
}