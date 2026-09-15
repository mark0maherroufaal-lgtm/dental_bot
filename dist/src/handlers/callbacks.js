"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCallbackHandlers = setupCallbackHandlers;
const supabase_1 = require("../supabase");
const articles_1 = require("../db/articles");
const gamification_1 = require("../db/gamification");
const planner_1 = require("../services/planner");
const tasks_1 = require("../commands/tasks");
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
        // معالجة أزرار المهام الديناميكية
        if (data.startsWith("tdo_")) {
            const taskId = data.substring(4);
            const resultMsg = await (0, planner_1.completeTask)(userId, taskId);
            await ctx.answerCallbackQuery({ text: resultMsg, show_alert: true });
            // Re-render the message
            const { text, buttons } = await (0, tasks_1.buildDynamicRoutineMessage)(userId);
            await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
        }
    });
}
