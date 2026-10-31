// src/commands/gamification.ts (xp_commands.ts)
// Stage 4: Gamification Achievements Command (/achievements) with Daily Streak Counter & Safe Progress Bar

import { Bot } from "grammy";
import {
    getTotalXp,
    calculateLevel,
    getActiveStreakDays
} from "../db/gamification";
import { getReadArticlesCount } from "../supabase";
import { isAuthorizedAdmin } from "../core/config";

export function setupGamificationCommands(bot: Bot) {
    bot.command("achievements", async (ctx) => {
        const userId = String(ctx.from?.id);
        if (!isAuthorizedAdmin(userId)) return;

        await ctx.replyWithChatAction("typing").catch(() => {});

        // Fetch XP, legacy article reads, and consecutive daily streak in parallel
        const [xp, articlesCount, streakDays] = await Promise.all([
            getTotalXp(userId),
            getReadArticlesCount(userId),
            getActiveStreakDays(userId)
        ]);

        const legacyXp = articlesCount * 10;
        const totalXp = Math.max(0, xp + legacyXp);

        const { levelText, nextLevelXp } = calculateLevel(totalXp);

        let progressText = "";
        if (totalXp >= 500) {
            progressText = "🔥 وصلت لأعلى مستوى (Master)! استمر على القمة يا دكتور!";
        } else {
            let currentLevelBaseXp = 0;
            if (totalXp >= 300) currentLevelBaseXp = 300;
            else if (totalXp >= 150) currentLevelBaseXp = 150;
            else if (totalXp >= 50) currentLevelBaseXp = 50;

            const xpInCurrentLevel = Math.max(0, totalXp - currentLevelBaseXp);
            const xpRequiredForNextLevel = Math.max(1, nextLevelXp - currentLevelBaseXp);
            const percentage = Math.max(
                0,
                Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForNextLevel) * 100))
            );

            const filledBlocks = Math.max(0, Math.min(10, Math.round(percentage / 10)));
            const progressBar = "▓".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

            progressText = `📊 التقدم للمستوى الجاي: [${progressBar}] ${percentage}%\n(فاضلك ${Math.max(0, nextLevelXp - totalXp)} XP)`;
        }

        const streakLine =
            streakDays > 0
                ? `🔥 **سلسلة الالتزام (Streak):** ${streakDays} ${streakDays === 1 ? "يوم" : "أيام متتالية"}`
                : `🔥 **سلسلة الالتزام (Streak):** ابدأ أول مهمة النهارده وشغّل الـ Streak!`;

        const replyText = [
            `🏆 **لوحة إنجازات د. ماركو** 🏆`,
            ``,
            `🎖️ **المستوى الحالي:** ${levelText}`,
            `⭐ **إجمالي النقاط:** ${totalXp} XP`,
            streakLine,
            ``,
            progressText
        ].join("\n");

        return ctx.reply(replyText, { parse_mode: "Markdown" });
    });
}