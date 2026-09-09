import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "POST") {
        try {
            const update = req.body;
            if (update) {
                await bot.handleUpdate(update);
            }
            res.status(200).send("OK");
        } catch (e) {
            console.error(e);
            res.status(200).send("Error handled gracefully");
        }
    } else {
        res.status(200).send("Bot is alive and ready!");
    }
}
