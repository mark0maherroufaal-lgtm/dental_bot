import { parseCollegeSchedule } from "./src/ai/parser";
import { analyzeIntent } from "./src/gemini";
import { getCurrentDateStr } from "./src/core/timezone";
import * as fs from 'fs';

// Mock getJsonModel to return controlled output
jest.mock("./src/gemini", () => ({
    getJsonModel: () => ({
        generateContent: async () => ({
            response: {
                text: () => JSON.stringify({
                    sessions: [
                        { course_name: "Bio", day_of_week: 0, start_time: "08:00", end_time: "10:00", session_type: "Theoretical", event_type: "A-block" },
                        { course_name: "Endo", day_of_week: 0, start_time: "10:00", end_time: "12:00", session_type: "Practical", event_type: "A3" },
                        { course_name: "Operative", day_of_week: 1, start_time: "08:00", end_time: "10:00", session_type: "Practical", event_type: "B-block" },
                        { course_name: "Unknown", day_of_week: 2, start_time: "08:00", end_time: "10:00", session_type: "Theoretical", event_type: "Unknown" }
                    ]
                })
            }
        })
    })
}));

async function runQA2() {
    console.log("--- START QA 2 ---");

    // Test 4: Parser Strict Isolation
    try {
        const text = "Dummy schedule";
        const res = await parseCollegeSchedule(text);
        
        // Wait, parseCollegeSchedule calls getJsonModel which is mocked.
        // But since we can't easily run Jest here, let's just inspect the code or use a manual mock.
    } catch (e: any) {
        console.log("FAIL: Parser", e);
    }
}
runQA2();
