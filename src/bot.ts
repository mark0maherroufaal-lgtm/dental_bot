import { Bot } from "grammy";
import { chatGemini, parseReminder } from "./gemini";
import { addTodo } from "./supabase";
export const bot = new Bot(process.env.BOT_TOKEN!);
bot.command("start", (ctx) => ctx.reply("أهلاً دكتور ماركو! البوت السحابي يعمل بكفاءة 🚀"));
bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.includes("فكرني") || text.includes("ذكرني")) {
        const parsed = await parseReminder(text);
        if (parsed) {
            await addTodo(parsed.task, parsed.date, String(ctx.from?.id));
            return ctx.reply(`✅ تم الجدولة:\nالمهمة: ${parsed.task}\nالتاريخ: ${parsed.date}`);
        }
    }
    await ctx.replyWithChatAction("typing");
    ctx.reply(await chatGemini(text));
});
