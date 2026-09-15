"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGamificationCommands = setupGamificationCommands;
const gamification_1 = require("../db/gamification");
const supabase_1 = require("../supabase");
function setupGamificationCommands(bot) {
    bot.command("achievements", async (ctx) => {
        const userId = String(ctx.from?.id);
        await ctx.replyWithChatAction("typing");
        // حساب النقاط الكلية من الـ XP Transactions
        const xp = await (0, gamification_1.getTotalXp)(userId);
        // جلب عدد المقالات القديمة لدمجها إذا أردنا، أو الاعتماد على XP فقط
        const articlesCount = await (0, supabase_1.getReadArticlesCount)(userId);
        const legacyXp = articlesCount * 10;
        const totalXp = xp + legacyXp; // دمج النقاط القديمة مع الجديدة
        const { levelText, nextLevelXp } = (0, gamification_1.calculateLevel)(totalXp);
        let progressText = "";
        if (totalXp >= 500) {
            progressText = "الحد الأقصى للمستوى!";
        }
        else {
            // حساب النسبة
            let currentLevelBaseXp = 0;
            if (totalXp >= 300)
                currentLevelBaseXp = 300;
            else if (totalXp >= 150)
                currentLevelBaseXp = 150;
            else if (totalXp >= 50)
                currentLevelBaseXp = 50;
            const xpInCurrentLevel = totalXp - currentLevelBaseXp;
            const xpRequiredForNextLevel = nextLevelXp - currentLevelBaseXp;
            const percentage = Math.round((xpInCurrentLevel / xpRequiredForNextLevel) * 100);
            const filledBlocks = Math.round(percentage / 10);
            const progressBar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);
            progressText = `التقدم للمستوى التالي: [${progressBar}] ${percentage}%\n(باقي ${nextLevelXp - totalXp} نقطة)`;
        }
        const replyText = `🏆 **نظام الإنجازات v3.0** 🏆\n\n`
            + `✨ إجمالي النقاط (XP): ${totalXp}\n\n`
            + `🎖️ **مستواك الحالي:**\n${levelText}\n\n`
            + `${progressText}\n\n`
            + `💡 *تلميح: أنهِ مهام /todo اليومية لكسب المزيد من النقاط!*`;
        return ctx.reply(replyText, { parse_mode: "Markdown" });
    });
}
