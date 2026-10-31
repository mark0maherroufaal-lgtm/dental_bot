"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCallbackHandlers = setupCallbackHandlers;
const supabase_1 = require("../supabase");
const articles_1 = require("../db/articles");
const gamification_1 = require("../db/gamification");
function setupCallbackHandlers(bot) {
    bot.on("callback_query:data", async (ctx) => {
        const data = ctx.callbackQuery.data;
        const userId = String(ctx.from?.id);
        // معالجة أزرار المقالات القديمة
        if (data.startsWith("art_")) {
            const type = data === "art_read" ? "قراءة مقال" : "فتح وقراءة رابط مقال";
            await (0, supabase_1.recordReadArticle)(type, userId);
            await ctx.answerCallbackQuery({ text: `🎉 عظيم جداً يا دكتور! تم تسجيل إنجازك (${type}) في سجلات الشهر بنجاح! 💪`, show_alert: true });
            return;
        }
        // قراءة مقال علمي (Scientific Engine)
        if (data.startsWith("read_")) {
            const articleId = data.substring(5);
            try {
                await (0, articles_1.updateArticleStatus)(articleId, 'COMPLETED', 30);
                await (0, gamification_1.addXpTransaction)(userId, 30, `Completed Scientific Reading - Article`);
                await ctx.answerCallbackQuery({ text: "✅ تم تسجيل قراءتك للمقال وإضافة 30 XP! عاش يا دكتور 👏", show_alert: true });
                // تعديل الأزرار لتعكس حالة القراءة
                await ctx.editMessageReplyMarkup({
                    reply_markup: { inline_keyboard: [[{ text: "🌟 تمت القراءة (+30 XP)", callback_data: "done" }]] }
                });
            }
            catch (e) {
                throw e;
            }
            return;
        }
        if (data.startsWith("skip_")) {
            const articleId = data.substring(5);
            try {
                await (0, articles_1.updateArticleStatus)(articleId, 'SKIPPED');
                await ctx.answerCallbackQuery({ text: "تم التأجيل. سنحاول اختيار مقال أقصر لاحقاً." });
                await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
            }
            catch (e) {
                throw e;
            }
            return;
        }
        // Note: Task buttons (tdo_, snz1h_, snz1d_, cancel_) are handled centrally in tasks_commands.ts
        // with completeTaskWithXp, idempotent locking, and midnight-safe snooze.
    });
}
