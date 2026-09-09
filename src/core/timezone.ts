// Timezone Configurations
// Africa/Cairo is the source of truth for the bot

export const DEFAULT_TIMEZONE = "Africa/Cairo";

export function getCurrentTime(): Date {
    // Return Date object adjusted for timezone if needed, or string
    // Standard way in JS is to use toLocaleString
    return new Date();
}

export function getCurrentDateStr(): string {
    const now = new Date();
    return now.toLocaleDateString("en-CA", { timeZone: DEFAULT_TIMEZONE }); // YYYY-MM-DD
}

export function getCurrentTimeStr(): string {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { timeZone: DEFAULT_TIMEZONE, hour12: false }); // HH:MM:SS
}

export function getCurrentTimestampStr(): string {
    const now = new Date();
    return now.toLocaleString("en-US", { timeZone: DEFAULT_TIMEZONE });
}
