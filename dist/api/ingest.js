"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const parser_1 = require("../src/ai/parser");
const supabase_1 = require("../src/supabase");
async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }
    try {
        // Simple security token check
        const token = req.headers['x-ingest-token'];
        if (!token || token !== process.env.INGEST_SECRET) {
            return res.status(401).send("Unauthorized");
        }
        const { text, source } = req.body;
        if (!text) {
            return res.status(400).send("Bad Request: Missing text");
        }
        // Parse using Gemini
        const result = await (0, parser_1.parseAcademicUpdate)(text);
        if (result.events && result.events.length > 0) {
            const inserts = result.events.map(event => ({
                event_type: event.event_type,
                title: event.title,
                event_date: event.event_date,
                original_message: text
            }));
            const { error } = await supabase_1.supabase.from('academic_events').insert(inserts);
            if (error) {
                console.error("Failed to insert academic events:", error);
                return res.status(500).send("Database Error");
            }
        }
        return res.status(200).json({ status: "processed", events_found: result.events.length });
    }
    catch (e) {
        console.error("Ingestion Error:", e);
        return res.status(500).send("Internal Server Error");
    }
}
