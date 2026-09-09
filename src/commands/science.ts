import { Bot } from "grammy";
import { chatGemini } from "../gemini";

export function setupScienceCommands(bot: Bot) {
    bot.command("dental", async (ctx) => {
        await ctx.replyWithChatAction("typing");
        
        const articlePrompt = `
أنت أستاذ جامعي في طب الأسنان (Basic Clinical Science). 
اكتب مقالاً علمياً محترماً ومفصلاً لدكتور أسنان عن موضوع عشوائي أو محدد في Basic Clinical Science.
يجب أن يحتوي المقال على:
- عنوان واضح.
- مقدمة علمية.
- صلب الموضوع (Pathophysiology أو Clinical details).
- تطبيق إكلينيكي (Clinical Application).
- رابط (Link): قم بإنشاء رابط بحث حقيقي على موقع PubMed يبحث عن هذا الموضوع (مثال: https://pubmed.ncbi.nlm.nih.gov/?term=dental+caries+management).
اكتب المقال بأسلوب طبي احترافي شيق.
`;
        const reply = await chatGemini(articlePrompt);
        
        // إنشاء أزرار تفاعلية للمقال
        const buttons = [
            [{ text: "📖 أتممت القراءة", callback_data: `art_read` }],
            [{ text: "🔗 فتحت الرابط وقرأته", callback_data: `art_link` }]
        ];
        
        return ctx.reply("🦷 مقال كلينيكال:\n\n" + reply, {
            reply_markup: { inline_keyboard: buttons }
        });
    });

    bot.command("article", async (ctx) => {
        // For now, prompt the user to send an article text to process
        return ctx.reply("📚 لإضافة مقال علمي لمكتبتك وتلخيصه، أرسل نص المقال أو الـ Abstract الخاص به متبوعاً بكلمة 'لخص'.\nأو يمكنك استخدام /dental لمقالة سريعة من البوت.");
    });
}
