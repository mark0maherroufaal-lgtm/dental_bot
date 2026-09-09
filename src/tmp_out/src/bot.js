"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
var grammy_1 = require("grammy");
var gemini_1 = require("./gemini");
var supabase_1 = require("./supabase");
exports.bot = new grammy_1.Bot(process.env.BOT_TOKEN);
exports.bot.catch(function (err) {
    console.error("Error while handling update ".concat(err.ctx.update.update_id, ":"));
    console.error(err.error);
});
exports.bot.command("start", function (ctx) {
    ctx.reply("أهلاً دكتور ماركو! البوت السحابي (v3.5) يعمل الآن بالذكاء المزدوج (Flash + Pro) 🚀🧠");
});
function processTextIntent(ctx, text, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var analysis, intent, parsed, todos, reply, usageCount, fallbackReply, proReply, remaining, error_1, fallbackReply, reply;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, gemini_1.analyzeIntent)(text)];
                case 1:
                    analysis = _a.sent();
                    intent = analysis.intent;
                    if (!(intent === "MEDICAL_EMERGENCY")) return [3 /*break*/, 2];
                    return [2 /*return*/, ctx.reply("⚠️ تنبيه: أنا مساعد ذكي ولست طبيباً. يبدو أن هذا الاستفسار طبي خطير. يُرجى استشارة طبيب بشري أو التوجه لأقرب عيادة فوراً.")];
                case 2:
                    if (!(intent === "CREATE_REMINDER")) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, gemini_1.parseReminder)(text)];
                case 3:
                    parsed = _a.sent();
                    if (!(parsed && parsed.task && parsed.date)) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, supabase_1.addTodo)(parsed.task, parsed.date, userId)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, ctx.reply("\u2705 \u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0647\u0645\u0629 \u0628\u0646\u062C\u0627\u062D:\n\uD83D\uDCCC ".concat(parsed.task, "\n\uD83D\uDCC5 ").concat(parsed.date))];
                case 5: return [2 /*return*/, ctx.reply("❌ عذراً، لم أتمكن من فهم التاريخ بدقة. هل يمكنك توضيحه؟")];
                case 6: return [3 /*break*/, 23];
                case 7:
                    if (!(intent === "STATISTICS")) return [3 /*break*/, 10];
                    return [4 /*yield*/, (0, supabase_1.getUserTodos)(userId)];
                case 8:
                    todos = _a.sent();
                    return [4 /*yield*/, (0, gemini_1.generateStatsReply)(text, todos)];
                case 9:
                    reply = _a.sent();
                    return [2 /*return*/, ctx.reply(reply)];
                case 10:
                    if (!(intent === "COMPLEX_ANALYSIS")) return [3 /*break*/, 21];
                    _a.label = 11;
                case 11:
                    _a.trys.push([11, 18, , 20]);
                    return [4 /*yield*/, (0, supabase_1.incrementProUsage)()];
                case 12:
                    usageCount = _a.sent();
                    if (!(usageCount > 50)) return [3 /*break*/, 15];
                    return [4 /*yield*/, ctx.reply("⚠️ (تنبيه: باقة الموديل الخارق انتهت اليوم. سأقوم بالرد باستخدام الموديل السريع).")];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, (0, gemini_1.chatGemini)(text)];
                case 14:
                    fallbackReply = _a.sent();
                    return [2 /*return*/, ctx.reply(fallbackReply)];
                case 15: return [4 /*yield*/, ctx.replyWithChatAction("typing")];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, (0, gemini_1.chatProGemini)(text)];
                case 17:
                    proReply = _a.sent();
                    // تحذير اقتراب انتهاء الباقة
                    if (usageCount >= 45 && usageCount <= 50) {
                        remaining = 50 - usageCount;
                        return [2 /*return*/, ctx.reply("".concat(proReply, "\n\n*(\u26A0\uFE0F \u062D\u0627\u0631\u0633 \u0627\u0644\u0628\u0627\u0642\u0629: \u0628\u0627\u0642\u064A \u0644\u0643 ").concat(remaining, " \u0631\u0633\u0627\u0626\u0644 \u0645\u0639\u0642\u062F\u0629 \u0641\u0642\u0637 \u0627\u0644\u064A\u0648\u0645)*"), { parse_mode: "Markdown" })];
                    }
                    return [2 /*return*/, ctx.reply(proReply)];
                case 18:
                    error_1 = _a.sent();
                    console.error("Pro Fallback triggered:", error_1);
                    return [4 /*yield*/, (0, gemini_1.chatGemini)(text)];
                case 19:
                    fallbackReply = _a.sent();
                    return [2 /*return*/, ctx.reply(fallbackReply)];
                case 20: return [3 /*break*/, 23];
                case 21: return [4 /*yield*/, (0, gemini_1.chatGemini)(text)];
                case 22:
                    reply = _a.sent();
                    return [2 /*return*/, ctx.reply(reply)];
                case 23: return [2 /*return*/];
            }
        });
    });
}
exports.bot.on("message:text", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, ctx.replyWithChatAction("typing")];
            case 1:
                _b.sent();
                return [4 /*yield*/, processTextIntent(ctx, ctx.message.text, String((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id))];
            case 2:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
exports.bot.on("message:voice", function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var voice, file, fileUrl, response, arrayBuffer, audioBase64String, transcribedText, error_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 9, , 11]);
                return [4 /*yield*/, ctx.replyWithChatAction("record_voice")];
            case 1:
                _b.sent();
                voice = ctx.msg.voice;
                if (!(voice.duration > 35)) return [3 /*break*/, 3];
                return [4 /*yield*/, ctx.reply("عذراً يا دكتور، الرسالة الصوتية طويلة جداً. الحد الأقصى 35 ثانية لضمان السرعة.")];
            case 2: return [2 /*return*/, _b.sent()];
            case 3: return [4 /*yield*/, ctx.getFile()];
            case 4:
                file = _b.sent();
                if (!file.file_path)
                    throw new Error("File path missing");
                fileUrl = "https://api.telegram.org/file/bot".concat(process.env.BOT_TOKEN, "/").concat(file.file_path);
                return [4 /*yield*/, fetch(fileUrl)];
            case 5:
                response = _b.sent();
                if (!response.ok)
                    throw new Error("Failed to download audio");
                return [4 /*yield*/, response.arrayBuffer()];
            case 6:
                arrayBuffer = _b.sent();
                audioBase64String = Buffer.from(arrayBuffer).toString("base64");
                return [4 /*yield*/, (0, gemini_1.transcribeAudio)(audioBase64String)];
            case 7:
                transcribedText = _b.sent();
                return [4 /*yield*/, processTextIntent(ctx, transcribedText, String((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id))];
            case 8:
                _b.sent();
                return [3 /*break*/, 11];
            case 9:
                error_2 = _b.sent();
                console.error("Voice Processing Error:", error_2);
                return [4 /*yield*/, ctx.reply("عذراً يا دكتور، حدث خطأ أثناء معالجة رسالتك الصوتية. يرجى المحاولة كتابياً.")];
            case 10:
                _b.sent();
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); });
