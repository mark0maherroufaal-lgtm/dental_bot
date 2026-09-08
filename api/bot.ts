import { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "POST") {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).send("OK");
        } catch (e) {
            console.error(e);
            res.status(500).send("Error");
        }
    } else {
        res.status(200).send("Bot is alive!");
    }
}
