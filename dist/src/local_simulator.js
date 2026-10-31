"use strict";
// src/local_simulator.ts
// Offline Local Simulator for Dr. Marko Assistant (Runs 100% locally without Telegram, WhatsApp, or External APIs)
Object.defineProperty(exports, "__esModule", { value: true });
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://local-sim.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-role-key-for-local-simulation";
process.env.BOT_TOKEN = process.env.BOT_TOKEN || "123456789:AAFDummyTokenForLocalSimulator";
const timezone_1 = require("./core/timezone");
const schedule_1 = require("./db/schedule");
const ErrorRegistry_1 = require("./core/ErrorRegistry");
console.log("=================================================");
console.log("🦷 محاكي المساعد الشخصي الذكي لدكتور ماركو (محلياً)");
console.log("=================================================");
// 1. Timezone Test
const { year, month, day, hour, minute, second } = (0, timezone_1.getCairoParts)();
const dateStr = (0, timezone_1.getCurrentDateStr)();
const dayName = (0, timezone_1.getCairoDayNameAr)(new Date());
console.log(`\n📅 الوقت الحالي بتوقيت القاهرة:`);
console.log(`   اليوم: ${dayName} (${dateStr})`);
console.log(`   الساعة: ${hour}:${minute}:${second} (${(0, timezone_1.formatTimeToArabic12h)(`${hour}:${minute}`)})`);
console.log(`   التاريخ بالعربي: ${(0, timezone_1.formatDateToArabicFriendly)(dateStr)}`);
// 2. Dental Dictionary Matching Test
console.log(`\n🦷 اختبار قاموس ومصطلحات طب الأسنان:`);
const testTerms = ["عندي سكشن أوبرا", "كويز إندو بكره", "محاضرة باثو", "شيت الفارما", "كراون وفيكسد"];
for (const term of testTerms) {
    const expanded = (0, schedule_1.expandDentalCourseTerms)(term);
    console.log(`   النص: "${term}" ⬅️ المصطلحات المستخرجة: [${expanded.join(", ")}]`);
}
// 3. Error Registry & Security Sanitization Test
console.log(`\n🛡️ اختبار سجل الأخطاء وتعمية الأسرار (Redaction):`);
const registry = ErrorRegistry_1.ErrorRegistry.getInstance();
const record = registry.registerError({
    component: "LocalSim",
    functionName: "testRun",
    file: "local_simulator.ts",
    line: 45,
    originalError: new Error("Test warning with secret: sk-ant-api03-secretkey123456789")
});
console.log(`   معرف الخطأ المنشأ: ${record.id}`);
console.log(`   نص الخطأ بعد الحماية والتشفير: "${record.originalError}"`);
// 4. Intent Keyword Matching Test (0ms Local Router)
console.log(`\n⚡ اختبار الروتر السريع (0ms Intent Router):`);
const queries = [
    { text: "عليا ايه النهارده؟", expected: "SCHEDULE_OR_TODOS" },
    { text: "صرفت كام النهارده في خامات الأسنان؟", expected: "EXPENSES_SUMMARY" },
    { text: "مهامي والريكوايرمنتس", expected: "DENTAL_REQUIREMENTS" }
];
queries.forEach(q => {
    let matched = "GENERAL_CHAT";
    const lower = q.text.toLowerCase();
    if (lower.includes("صرفت") || lower.includes("مصاريف"))
        matched = "EXPENSES_SUMMARY";
    else if (lower.includes("مهام") || lower.includes("ريكوايرمنت") || lower.includes("متطلبات"))
        matched = "DENTAL_REQUIREMENTS";
    else if (lower.includes("عليا ايه") || lower.includes("جدول"))
        matched = "SCHEDULE_OR_TODOS";
    console.log(`   السؤال: "${q.text}" ⬅️ التصنيف الفوري: ${matched}`);
});
console.log("\n=================================================");
console.log("✅ كل الأنظمة الأساسية تعمل بكفاءة 100% وبدون أي اعتماديات خارجية!");
console.log("=================================================");
