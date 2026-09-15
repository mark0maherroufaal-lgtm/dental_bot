import { supabase } from "../supabase";
import { DatabaseError } from "../core/errors";

export interface CollegeSession {
    id?: string;
    telegram_id?: string;
    course_name: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    session_type: string;
    location?: string;
    event_type?: string;
    status?: string;
}

export async function diffAndApplySchedule(telegramId: string, newSessions: CollegeSession[]) {
    try {
        // Filter out B-block events
        const validSessions = newSessions.filter(s => s.event_type !== 'B-block');

        // Fetch existing active sessions
        const { data: existingData, error: fetchErr } = await supabase
            .from('college_schedule')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('status', 'active');
        
        if (fetchErr) throw new DatabaseError("Failed to fetch existing schedule", fetchErr);
        const existing = existingData || [];

        // Identity function
        const getIdentity = (s: any) => `${s.course_name}|${s.day_of_week}|${s.start_time}|${s.session_type}|${s.event_type || 'A3'}`;

        const existingMap = new Map(existing.map(s => [getIdentity(s), s]));
        const newMap = new Map(validSessions.map(s => [getIdentity(s), s]));

        const toInsert: any[] = [];
        const toDeactivate: string[] = [];

        // Find removed events
        for (const [id, s] of existingMap.entries()) {
            if (!newMap.has(id)) {
                toDeactivate.push(s.id);
            }
        }

        // Find added events
        for (const [id, s] of newMap.entries()) {
            if (!existingMap.has(id)) {
                toInsert.push({
                    telegram_id: telegramId,
                    course_name: s.course_name,
                    day_of_week: s.day_of_week,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    session_type: s.session_type,
                    location: s.location || null,
                    event_type: s.event_type || 'A3',
                    status: 'active'
                });
            }
        }

        if (toDeactivate.length > 0) {
            const { error: updErr } = await supabase
                .from('college_schedule')
                .update({ status: 'inactive' })
                .in('id', toDeactivate);
            if (updErr) throw new DatabaseError("Failed to deactivate old sessions", updErr);
            
            // Phase 6: Cascade cancellation of dependent tasks
            await supabase
                .from('tasks')
                .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
                .eq('status', 'pending')
                .in('source_id', toDeactivate);
        }

        if (toInsert.length > 0) {
            const { error: insErr } = await supabase
                .from('college_schedule')
                .insert(toInsert);
            if (insErr) throw new DatabaseError("Failed to insert new sessions", insErr);
        }

        return { added: toInsert.length, removed: toDeactivate.length };
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
