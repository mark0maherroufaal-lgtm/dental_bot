"use strict";
// Timezone Configurations
// Africa/Cairo is the source of truth for the bot
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TIMEZONE = void 0;
exports.getCurrentTime = getCurrentTime;
exports.getCurrentDateStr = getCurrentDateStr;
exports.getCurrentTimeStr = getCurrentTimeStr;
exports.getCurrentTimestampStr = getCurrentTimestampStr;
exports.DEFAULT_TIMEZONE = "Africa/Cairo";
function getCurrentTime() {
    // Return Date object adjusted for timezone if needed, or string
    // Standard way in JS is to use toLocaleString
    return new Date();
}
function getCurrentDateStr() {
    const now = new Date();
    return now.toLocaleDateString("en-CA", { timeZone: exports.DEFAULT_TIMEZONE }); // YYYY-MM-DD
}
function getCurrentTimeStr() {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { timeZone: exports.DEFAULT_TIMEZONE, hour12: false }); // HH:MM:SS
}
function getCurrentTimestampStr() {
    const now = new Date();
    return now.toLocaleString("en-US", { timeZone: exports.DEFAULT_TIMEZONE });
}
