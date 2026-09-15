"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateRequiredConfig = validateRequiredConfig;
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
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
            throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
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
        const adminId = process.env.ADMIN_ID || process.env.ADMIN_TELEGRAM_ID;
        if (!adminId)
            throw new Error("Missing ADMIN_ID config");
        return adminId;
    },
    get WEBHOOK_SECRET() {
        return process.env.WEBHOOK_SECRET || null;
    }
};
function validateRequiredConfig() {
    exports.config.BOT_TOKEN;
    exports.config.SUPABASE_URL;
    exports.config.SUPABASE_SERVICE_ROLE_KEY;
    // Don't fail the whole app on boot if ADMIN_ID is missing, but fail gracefully when admin actions are attempted.
    console.log("[Config] All core environment variables are present.");
}
