"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addArticleRecord = addArticleRecord;
exports.updateArticleStatus = updateArticleStatus;
exports.getArticle = getArticle;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
async function addArticleRecord(article) {
    try {
        const { data, error } = await supabase_1.supabase.from('scientific_articles').insert([{
                telegram_id: article.telegram_id,
                title: article.title,
                source: article.source,
                url: article.url,
                doi: article.doi,
                topic: article.topic,
                category: article.category,
                reading_status: 'SENT',
                clinical_takeaway: article.clinical_takeaway
            }]).select('id').single();
        if (error)
            throw new errors_1.DatabaseError("Failed to save article", error);
        return data.id;
    }
    catch (e) {
        console.error(e);
        throw e;
    }
}
async function updateArticleStatus(id, status, xp = 0) {
    try {
        const updateData = { reading_status: status };
        if (status === 'OPENED')
            updateData.opened_at = new Date().toISOString();
        if (status === 'COMPLETED')
            updateData.completed_at = new Date().toISOString();
        if (xp > 0) {
            // Need to get current xp and add, or just set if it's the only xp awarded.
            // Simplified: we just set xp_awarded to the cumulative XP earned.
            updateData.xp_awarded = xp;
        }
        const { error } = await supabase_1.supabase.from('scientific_articles').update(updateData).eq('id', id);
        if (error)
            throw new errors_1.DatabaseError("Failed to update article status", error);
    }
    catch (e) {
        console.error(e);
        throw e;
    }
}
async function getArticle(id) {
    try {
        const { data, error } = await supabase_1.supabase.from('scientific_articles').select('*').eq('id', id).single();
        if (error)
            return null;
        return data;
    }
    catch (e) {
        return null;
    }
}
