"use strict";
// src/core/config.ts
// Centralized Configuration, Security Guardrails & Specialized AI Model Registry
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_REGISTRY = exports.config = exports.DEFAULT_ADMIN_TELEGRAM_ID = void 0;
exports.isAuthorizedAdmin = isAuthorizedAdmin;
exports.validateRequiredConfig = validateRequiredConfig;
exports.DEFAULT_ADMIN_TELEGRAM_ID = "5785296270";
exports.config = {
    get BOT_TOKEN() {
        if (!process.env.BOT_TOKEN)
            throw new Error("Missing BOT_TOKEN");
        return process.env.BOT_TOKEN;
    },
    get SUPABASE_URL() {
        if (!process.env.SUPABASE_URL)
            throw new Error("Missing SUPABASE_URL");
        return process.env.SUPABASE_URL;
    },
    get SUPABASE_SERVICE_ROLE_KEY() {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
        }
        return process.env.SUPABASE_SERVICE_ROLE_KEY;
    },
    get GROQ_API_KEY() {
        return process.env.GROQ_API_KEY || null;
    },
    get GEMINI_API_KEY() {
        return process.env.GEMINI_API_KEY || null;
    },
    get GEMINI_PRO_API_KEY() {
        return process.env.GEMINI_PRO_API_KEY || process.env.GEMINI_API_KEY || null;
    },
    get NOTION_SECRET() {
        return process.env.NOTION_SECRET || null;
    },
    get ADMIN_ID() {
        // Hard-fallback to Dr. Marko's Telegram ID (5785296270) so the bot never locks him out
        const adminId = process.env.ADMIN_ID ||
            process.env.ADMIN_TELEGRAM_ID ||
            exports.DEFAULT_ADMIN_TELEGRAM_ID;
        return String(adminId).trim();
    },
    get WEBHOOK_SECRET() {
        return process.env.WEBHOOK_SECRET || null;
    },
    get CRON_SECRET() {
        return process.env.CRON_SECRET || process.env.WEBHOOK_SECRET || null;
    },
    get DAILY_PRO_LIMIT() {
        const parsed = parseInt(process.env.DAILY_PRO_LIMIT || "50", 10);
        return isNaN(parsed) || parsed <= 0 ? 50 : parsed;
    }
};
/**
 * Specialized Multi-Model Registry with Zero-Downtime Automatic Fallback Chains.
 * Every primary model can be overridden from Vercel Environment Variables without touching code.
 */
exports.MODEL_REGISTRY = {
    // 1. Single-Pass AI Maestro (Intent Routing + Fast JSON Extraction for Tasks/Expenses)
    MAESTRO_FAST: [
        {
            provider: "gemini",
            model: process.env.GEMINI_FAST_MODEL || "gemini-3.1-flash-lite"
        },
        {
            provider: "gemini",
            model: "gemini-2.5-flash"
        },
        {
            provider: "gemini",
            model: "gemini-2.5-flash-lite"
        },
        {
            provider: "groq",
            model: process.env.GROQ_CHAT_MODEL || "qwen/qwen3.8-27b"
        }
    ],
    // 2. Main Egyptian Arabic Chat Persona (Fast, natural Egyptian dialect, reasoning disabled)
    CHAT_EGYPTIAN: [
        {
            provider: "groq",
            model: process.env.GROQ_CHAT_MODEL || "qwen/qwen3.8-27b"
        },
        {
            provider: "groq",
            model: "openai/gpt-oss-120b"
        },
        {
            provider: "groq",
            model: "openai/gpt-oss-20b"
        },
        {
            provider: "gemini",
            model: process.env.GEMINI_FAST_MODEL || "gemini-3.1-flash-lite"
        },
        {
            provider: "gemini",
            model: "gemini-2.5-flash"
        }
    ],
    // 3. Receipt OCR (Vision) & Long College Schedule Parsing
    VISION_AND_SCHEDULE: [
        {
            provider: "gemini",
            model: process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash"
        },
        {
            provider: "gemini",
            model: "gemini-3.1-flash-lite"
        },
        {
            provider: "gemini",
            model: "gemini-2.5-flash"
        }
    ],
    // 4. Complex Study/Budget Analysis (Protected by 50 uses/day atomic counter)
    DEEP_ANALYSIS: [
        {
            provider: "gemini",
            model: process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview"
        },
        {
            provider: "gemini",
            model: "gemini-2.5-pro"
        },
        {
            provider: "gemini",
            model: "gemini-3.5-flash"
        },
        {
            provider: "groq",
            model: "openai/gpt-oss-120b"
        }
    ],
    // 5. Voice Note Transcription (audio/ogg)
    VOICE_TRANSCRIBE: [
        {
            provider: "groq",
            model: process.env.GROQ_AUDIO_MODEL || "whisper-large-v3"
        },
        {
            provider: "groq",
            model: "whisper-large-v3-turbo"
        },
        {
            provider: "gemini",
            model: process.env.GEMINI_FAST_MODEL || "gemini-3.1-flash-lite"
        },
        {
            provider: "gemini",
            model: "gemini-2.5-flash"
        }
    ]
};
/**
 * Strict authorization check: Only Dr. Marko (5785296270) is allowed to interact with the bot.
 */
function isAuthorizedAdmin(telegramId) {
    if (telegramId === undefined || telegramId === null)
        return false;
    return String(telegramId).trim() === exports.config.ADMIN_ID;
}
function validateRequiredConfig() {
    exports.config.BOT_TOKEN;
    exports.config.SUPABASE_URL;
    exports.config.SUPABASE_SERVICE_ROLE_KEY;
    if (!exports.config.GEMINI_API_KEY && !exports.config.GROQ_API_KEY) {
        console.warn("[Config] WARNING: Neither GEMINI_API_KEY nor GROQ_API_KEY is set!");
    }
    console.log(`[Config] Core config validated. Locked to ADMIN_ID=${exports.config.ADMIN_ID}`);
}
