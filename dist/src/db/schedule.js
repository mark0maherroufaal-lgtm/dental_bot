"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffAndApplySchedule = diffAndApplySchedule;
exports.getScheduleForDay = getScheduleForDay;
const supabase_1 = require("../supabase");
const errors_1 = require("../core/errors");
async function diffAndApplySchedule(telegramId, newSessions) {
    try {
        // Filter out B-block events
        const validSessions = newSessions.filter(s => s.event_type !== 'B-block');
        // Fetch existing active sessions
        const { data: existingData, error: fetchErr } = await supabase_1.supabase
            .from('college_schedule')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('status', 'active');
        if (fetchErr)
            throw new errors_1.DatabaseError("Failed to fetch existing schedule", fetchErr);
        const existing = existingData || [];
        // Identity function
        const getIdentity = (s) => `${s.course_name}|${s.day_of_week}|${s.start_time}|${s.session_type}|${s.event_type || 'A3'}`;
        const existingMap = new Map(existing.map(s => [getIdentity(s), s]));
        const newMap = new Map(validSessions.map(s => [getIdentity(s), s]));
        const toInsert = [];
        const toDeactivate = [];
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
            const { error: updErr } = await supabase_1.supabase
                .from('college_schedule')
                .update({ status: 'inactive' })
                .in('id', toDeactivate);
            if (updErr)
                throw new errors_1.DatabaseError("Failed to deactivate old sessions", updErr);
            // Phase 6: Cascade cancellation of dependent tasks
            await supabase_1.supabase
                .from('tasks')
                .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
                .eq('status', 'pending')
                .in('source_id', toDeactivate);
        }
        if (toInsert.length > 0) {
            const { error: insErr } = await supabase_1.supabase
                .from('college_schedule')
                .insert(toInsert);
            if (insErr)
                throw new errors_1.DatabaseError("Failed to insert new sessions", insErr);
        }
        return { added: toInsert.length, removed: toDeactivate.length };
    }
    catch (e) {
        console.error(e);
        throw e;
    }
}
async function getScheduleForDay(telegramId, dayOfWeek) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('college_schedule')
            .select('*')
            .eq('telegram_id', telegramId)
            .eq('day_of_week', dayOfWeek)
            .order('start_time', { ascending: true });
        if (error)
            throw new errors_1.DatabaseError("Failed to get schedule", error);
        return data || [];
    }
    catch (e) {
        console.error(e);
        return [];
    }
}
