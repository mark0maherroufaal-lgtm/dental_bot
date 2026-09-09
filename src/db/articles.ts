import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";

export interface ScientificArticle {
    id?: string;
    telegram_id: string;
    title: string;
    source?: string;
    url?: string;
    doi?: string;
    topic?: string;
    category?: string;
    reading_status?: string;
    sent_at?: string;
    opened_at?: string;
    completed_at?: string;
    xp_awarded?: number;
    rating?: number;
    notes?: string;
    clinical_takeaway?: string;
}

export async function addArticleRecord(article: ScientificArticle): Promise<string> {
    try {
        const { data, error } = await supabase.from('scientific_articles').insert([{
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
        
        if (error) throw new DatabaseError("Failed to save article", error);
        return data.id;
    } catch (e: any) {
        console.error(e);
        throw e;
    }
}

export async function updateArticleStatus(id: string, status: string, xp: number = 0): Promise<void> {
    try {
        const updateData: any = { reading_status: status };
        if (status === 'OPENED') updateData.opened_at = new Date().toISOString();
        if (status === 'COMPLETED') updateData.completed_at = new Date().toISOString();
        if (xp > 0) {
            // Need to get current xp and add, or just set if it's the only xp awarded.
            // Simplified: we just set xp_awarded to the cumulative XP earned.
            updateData.xp_awarded = xp; 
        }

        const { error } = await supabase.from('scientific_articles').update(updateData).eq('id', id);
        if (error) throw new DatabaseError("Failed to update article status", error);
    } catch (e: any) {
        console.error(e);
        throw e;
    }
}

export async function getArticle(id: string): Promise<ScientificArticle | null> {
    try {
        const { data, error } = await supabase.from('scientific_articles').select('*').eq('id', id).single();
        if (error) return null;
        return data as ScientificArticle;
    } catch (e) {
        return null;
    }
}
