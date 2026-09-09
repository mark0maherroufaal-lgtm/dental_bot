import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";
import { tryMarkUpdateProcessed } from "../src/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "POST") {
        try {
            // 🛡️ Security: Verify Telegram Webhook Secret Token
            const secretToken = process.env.BOT_SECRET_TOKEN;
            if (secretToken && req.headers['x-telegram-bot-api-secret-token'] !== secretToken) {
                console.warn("Unauthorized webhook access attempt.");
                return res.status(401).send("Unauthorized");
            }

            const update = req.body;
            
            // مانع التكرار (Idempotency) - ⚡ Performance Fix: Single DB Call
            if (update && update.update_id) {
                const isNew = await tryMarkUpdateProcessed(update.update_id);
                if (!isNew) {
                    return res.status(200).send("Duplicate ignored");
                }
                
                // تمت برمجة معلومات البوت داخلياً، لم نعد بحاجة لـ bot.init() إطلاقاً
                await bot.handleUpdate(update);
            }
            
            res.status(200).send("OK");
        } catch (e) {
            console.error(e);
            res.status(200).send("Error handled gracefully");
        }
    } else {
        res.status(200).send("Bot is alive!");
    }
}
