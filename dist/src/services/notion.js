"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTaskToNotion = syncTaskToNotion;
exports.syncExpenseToNotion = syncExpenseToNotion;
async function syncTaskToNotion(task) {
    if (!process.env.NOTION_SECRET) {
        // Graceful failure as requested
        return;
    }
    try {
        // In a real implementation we would use @notionhq/client
        // and sync the task attributes.
        // For now, this is a placeholder acknowledging the architecture rules.
        console.log(`Simulating one-way Notion sync for task ${task.id}`);
    }
    catch (error) {
        console.error("Notion Sync Error (Ignored to keep bot alive):", error);
    }
}
async function syncExpenseToNotion(expense) {
    if (!process.env.NOTION_SECRET) {
        return;
    }
    try {
        console.log(`Simulating one-way Notion sync for expense`);
    }
    catch (error) {
        console.error("Notion Sync Error:", error);
    }
}
