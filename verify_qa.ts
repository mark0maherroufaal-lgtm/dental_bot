import { ErrorRegistry } from "./src/core/ErrorRegistry";
import { config } from "./src/core/config";
import { parseReminder } from "./src/gemini";
import { getCurrentDateStr } from "./src/core/timezone";
import * as fs from 'fs';

async function runQA() {
    console.log("--- START QA VERIFICATION ---");

    // Test 1: Config
    try {
        process.env.ADMIN_ID = "";
        process.env.ADMIN_TELEGRAM_ID = "12345";
        if (config.ADMIN_ID !== "12345") throw new Error("Config ADMIN_ID fallback failed");
        console.log("PASS: Config fallback");
    } catch (e: any) {
        console.log("FAIL: Config", e.message);
    }

    // Test 2: Error Registry
    try {
        const registry = ErrorRegistry.getInstance();
        const err1 = new Error("Test 1");
        const r1 = registry.registerError({ component: "Test", functionName: "f", file: "test.ts", line: 1, originalError: err1 });
        const r2 = registry.registerError({ component: "Test", functionName: "f", file: "test.ts", line: 1, originalError: err1 });
        
        if (r2.occurrences !== 2) throw new Error("Error Registry duplication failed, expected 2 occurrences");
        
        // Ensure secrets are redacted
        const err2 = new Error("My secret is sk-123456789012345678901234567890123456");
        const r3 = registry.registerError({ component: "Test", functionName: "f", file: "test2.ts", line: 2, originalError: err2 });
        if (r3.originalError.includes("sk-")) throw new Error("Error Registry failed to redact secrets");
        
        console.log("PASS: Error Registry");
    } catch (e: any) {
        console.log("FAIL: Error Registry", e.message);
    }

    // Test 3: Timezone
    try {
        const today = getCurrentDateStr();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Timezone formatting invalid");
        console.log("PASS: Timezone formatting");
    } catch (e: any) {
        console.log("FAIL: Timezone", e.message);
    }

    console.log("--- END QA VERIFICATION ---");
}

runQA();
