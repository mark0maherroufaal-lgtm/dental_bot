import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const cairoTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
        const hour = new Date(cairoTime).getHours();
        
        if (hour >= 2 && hour <= 8) {
            return res.status(200).json({ status: "skipped_sleep_time" });
        }
        
        const message = `💰 **Check-in**\nصرفت أي فلوس من آخر مرة سألتك؟\nلو آه ابعتهالي، ولو عندك إيصال ابعته صورة وأنا أسجله.`;
        
        const adminId = process.env.ADMIN_TELEGRAM_ID || "5785296270";
        if (adminId) {
             await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
        }
        
        res.status(200).json({ status: "cron_executed" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: "error" });
    }
}