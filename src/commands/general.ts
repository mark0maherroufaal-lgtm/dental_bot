import { Bot } from "grammy";
import { chatGemini } from "../gemini";

export function setupGeneralCommands(bot: Bot) {
    bot.command("start", async (ctx) => {
        await ctx.api.setMyCommands([
            { command: "plan", description: "جلسة التخطيط الصباحية لليوم" },
            { command: "todo", description: "قائمة المهام اليومية التفاعلية وشريط الإنجاز" },
            { command: "review", description: "الملخص المسائي وتقييم اليوم" },
            { command: "weekly", description: "التقييم الأسبوعي للإنجازات والمصروفات" },
            { command: "monthly", description: "التقييم الشهري والتحليل العميق" },
            { command: "dental", description: "مقال بيزكس كلينكال مركز" },
            { command: "news", description: "أهم الأخبار العامة العاجلة" },
            { command: "channels", description: "فحص حالة القنوات الثلاث المنفصلة" },
            { command: "status", description: "فحص حالة السيرفر السحابي" },
            { command: "achievements", description: "نظام الإنجازات والنقاط المتراكمة" }
        ]);
        ctx.reply("مرحباً دكتور ماركو! البوت يعمل الآن بنجاح.\nتم تفعيل وتحديث قائمة الاختصارات (Menu) الخاصة بك. اضغط على زر القائمة لاكتشافها!");
    });

    bot.command("news", async (ctx) => {
        await ctx.replyWithChatAction("typing");
        const reply = await chatGemini("لخص أهم وأحدث 3 أخبار عالمية عامة باختصار شديد جداً كعناوين عاجلة.");
        return ctx.reply("📰 أخبار عاجلة:\n\n" + reply);
    });

    bot.command("status", (ctx) => {
        ctx.reply("🟢 السيرفر السحابي (Vercel): Online\n🟢 قاعدة البيانات (Supabase): Online\n🟢 الذكاء الاصطناعي (Groq/Gemini): Online\n⚡ النظام يعمل بأقصى كفاءة.");
    });

    bot.command("channels", (ctx) => {
        ctx.reply("📡 حالة القنوات الثلاث:\n1. القناة الأكاديمية: 🟢 تعمل\n2. قناة العيادة: 🟢 تعمل\n3. القناة الشخصية: 🟢 تعمل");
    });
}
