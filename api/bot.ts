import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";
import { isUpdateProcessed, markUpdateProcessed } from "../src/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "POST") {
        try {
            const update = req.body;
            
            // مانع التكرار (Idempotency)
            if (update && update.update_id) {
                const alreadyProcessed = await isUpdateProcessed(update.update_id);
                if (alreadyProcessed) {
                    return res.status(200).send("Duplicate ignored");
                }
                
                // 🔥 الحل السحري: تهيئة البوت يدوياً قبل المعالجة
                await bot.init();
                
                await bot.handleUpdate(update);
                await markUpdateProcessed(update.update_id);
            }
            
            // الرد بـ 200 دائماً لحماية الـ Webhook
            res.status(200).send("OK");
        } catch (e) {
            console.error(e);
            res.status(200).send("Error handled gracefully");
        }
    } else {
        res.status(200).send("Bot is alive!");
    }
}
