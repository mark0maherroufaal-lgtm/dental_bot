import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";
import { ErrorRegistry } from "../src/core/ErrorRegistry";

let initialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "POST") {
        try {
            // Validate webhook secret if configured
            const secret = process.env.WEBHOOK_SECRET;
            if (secret) {
                const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
                if (headerSecret !== secret) {
                    return res.status(401).send("Unauthorized");
                }
            }

            if (!initialized) {
                await bot.init();
                initialized = true;
            }

            const update = req.body;
            if (update) {
                await bot.handleUpdate(update);
            }
        } catch (e) {
            console.error(e);
            // We catch the error to prevent Vercel from crashing before the flush
        } finally {
            // CRITICAL: Explicitly absorb the latency and await the Supabase insert BEFORE the 200 OK.
            // This guarantees Vercel does not freeze the context mid-flight.
            await ErrorRegistry.getInstance().flush();
            res.status(200).send("OK");
        }
    } else {
        res.status(200).send("Bot is alive and ready!");
    }
}
