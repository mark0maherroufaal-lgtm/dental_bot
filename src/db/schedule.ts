import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";

export interface CollegeSession {
    id?: string;
    telegram_id: string;
    course_name: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    session_type: string;
    location?: string;
}

export async function addCollegeSessions(telegramId: string, sessions: CollegeSession[]) {
    try {
        const toInsert = sessions.map(s => ({
            telegram_id: telegramId,
            course_name: s.course_name,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            session_type: s.session_type,
            location: s.location || null
        }));
        
        const { error } = await supabase.from('college_schedule').insert(toInsert);
        if (error) throw new DatabaseError("Failed to save college schedule", error);
    } catch (e: any) {
        console.error(e);
        throw e;
    }
}

export async function getScheduleForDay(telegramId: string, dayOfWeek: number): Promise<CollegeSession[]> {
    try {
        const { data, error } = await supabase
            .from('college_schedule')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('day_of_week', dayOfWeek)
            .order('start_time', { ascending: true });
            
        if (error) throw new DatabaseError("Failed to get schedule", error);
        return data || [];
    } catch (e: any) {
        console.error(e);
        return [];
    }
}
