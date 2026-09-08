import { Bot } from "grammy";
import { analyzeIntent, chatGemini, parseReminder, generateStatsReply } from "./gemini";
import { addTodo, getUserTodos } from "./supabase";

export const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", (ctx) => {
    ctx.reply("أهلاً دكتور ماركو! البوت السحابي (v3.2) جاهز الآن مع نظام الاستعلامات الذكي 📊🚀");
});

bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const userId = String(ctx.from?.id);
    
    await ctx.replyWithChatAction("typing");

    const analysis = await analyzeIntent(text);
    const intent = analysis.intent;

    if (intent === "MEDICAL_EMERGENCY") {
        return ctx.reply("⚠️ تنبيه: أنا مساعد ذكي ولست طبيباً. يبدو أن هذا الاستفسار طبي خطير. يُرجى استشارة طبيب بشري أو التوجه لأقرب عيادة فوراً ولا تعتمد على الذكاء الاصطناعي في التشخيص.");
    } 
    
    else if (intent === "CREATE_REMINDER") {
        const parsed = await parseReminder(text);
        if (parsed && parsed.task && parsed.date) {
            await addTodo(parsed.task, parsed.date, userId);
            return ctx.reply(`✅ تم تسجيل المهمة بنجاح:\n📌 ${parsed.task}\n📅 ${parsed.date}`);
        } else {
            return ctx.reply("❌ عذراً، لم أتمكن من فهم التاريخ بدقة. هل يمكنك توضيحه؟");
        }
    } 
    
    // 🚀 [جديد] التوجيه لرد الإحصائيات والاستعلامات
    else if (intent === "STATISTICS") {
        const todos = await getUserTodos(userId);
        const reply = await generateStatsReply(text, todos);
        return ctx.reply(reply);
    }
    
    else {
        const reply = await chatGemini(text);
        return ctx.reply(reply);
    }
});
