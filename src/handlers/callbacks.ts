import { Bot } from "grammy";
import { recordReadArticle } from "../supabase";
import { updateArticleStatus } from "../db/articles";
import { addXpTransaction } from "../db/gamification";
import { completeTask } from "../services/planner";
import { buildDynamicRoutineMessage } from "../commands/tasks";

export function setupCallbackHandlers(bot: Bot) {
    bot.on("callback_query:data", async (ctx) => {
        const data = ctx.callbackQuery.data;
        const userId = String(ctx.from?.id);
        
        // معالجة أزرار المقالات القديمة
        if (data.startsWith("art_")) {
            const type = data === "art_read" ? "قراءة مقال" : "فتح وقراءة رابط مقال";
            
            await recordReadArticle(type, userId);
            await ctx.answerCallbackQuery({ text: `🎉 عظيم جداً يا دكتور! تم تسجيل إنجازك (${type}) في سجلات الشهر بنجاح! 💪`, show_alert: true });
            return;
        }
        
        // قراءة مقال علمي (Scientific Engine)
        if (data.startsWith("read_")) {
            const articleId = data.substring(5);
            
            try {
                await updateArticleStatus(articleId, 'COMPLETED', 30);
                await addXpTransaction(userId, 30, `Completed Scientific Reading - Article`);
                
                await ctx.answerCallbackQuery({ text: "✅ تم تسجيل قراءتك للمقال وإضافة 30 XP! عاش يا دكتور 👏", show_alert: true });
                
                // تعديل الأزرار لتعكس حالة القراءة
                await ctx.editMessageReplyMarkup({ 
                    reply_markup: { inline_keyboard: [[{ text: "🌟 تمت القراءة (+30 XP)", callback_data: "done" }]] } 
                });
            } catch (e) {
                console.error(e);
                await ctx.answerCallbackQuery({ text: "❌ حدث خطأ أثناء التحديث.", show_alert: true });
            }
            return;
        }

        if (data.startsWith("skip_")) {
            const articleId = data.substring(5);
            try {
                await updateArticleStatus(articleId, 'SKIPPED');
                await ctx.answerCallbackQuery({ text: "تم التأجيل. سنحاول اختيار مقال أقصر لاحقاً." });
                await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
            } catch (e) {
                await ctx.answerCallbackQuery({ text: "❌ حدث خطأ." });
            }
            return;
        }
        
        // معالجة أزرار المهام الديناميكية
        if (data.startsWith("tdo_")) {
            const taskId = data.substring(4);
            
            try {
                const resultMsg = await completeTask(userId, taskId);
                await ctx.answerCallbackQuery({ text: resultMsg, show_alert: true });
                
                // Re-render the message
                const { text, buttons } = await buildDynamicRoutineMessage(userId);
                await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
            } catch (e) {
                console.error(e);
                await ctx.answerCallbackQuery({ text: "حدث خطأ أثناء إتمام المهمة.", show_alert: true });
            }
        }
    });
}
