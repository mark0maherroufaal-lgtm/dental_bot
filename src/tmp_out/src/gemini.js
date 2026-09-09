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
exports.transcribeAudio = transcribeAudio;
exports.analyzeIntent = analyzeIntent;
exports.chatGemini = chatGemini;
exports.chatProGemini = chatProGemini;
exports.parseReminder = parseReminder;
exports.generateStatsReply = generateStatsReply;
var generative_ai_1 = require("@google/generative-ai");
var zod_1 = require("zod");
// مفتاح الموديل السريع (Flash)
var genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// مفتاح الموديل الخارق (Pro)
var genAIPro = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_PRO_API_KEY);
var SYSTEM_INSTRUCTIONS = "\n\u0623\u0646\u062A \u0633\u0643\u0631\u062A\u064A\u0631 \u0637\u0628\u064A \u0630\u0643\u064A \u0648\u0645\u062D\u062A\u0631\u0641 \u0644\u062F\u0643\u062A\u0648\u0631 \u0645\u0627\u0631\u0643\u0648 (\u0637\u0628\u064A\u0628 \u0623\u0633\u0646\u0627\u0646).\n\u0623\u062C\u0628 \u0628\u0627\u062E\u062A\u0635\u0627\u0631 \u0648\u0644\u0637\u0641. \n\u0645\u0645\u0646\u0648\u0639 \u0645\u0646\u0639\u0627\u064B \u0628\u0627\u062A\u0627\u064B \u062A\u0642\u062F\u064A\u0645 \u0623\u064A \u062A\u0634\u062E\u064A\u0635 \u0637\u0628\u064A \u0642\u0627\u0637\u0639 \u0623\u0648 \u0648\u0635\u0641 \u0623\u062F\u0648\u064A\u0629 \u0645\u0647\u0645\u0627 \u0643\u0627\u0646 \u0637\u0644\u0628 \u0627\u0644\u0645\u0631\u064A\u0636.\n";
var chatModel = genAI.getGenerativeModel({
    model: "gemini-3.8-flash",
    systemInstruction: SYSTEM_INSTRUCTIONS
});
var jsonModel = genAI.getGenerativeModel({
    model: "gemini-3.8-flash",
    generationConfig: { responseMimeType: "application/json" }
});
// 🚀 الموديل الخارق للمهام المعقدة
var proModel = genAIPro.getGenerativeModel({
    model: "gemini-3.1-pro",
    systemInstruction: "أنت خبير ومعاون طبي محترف للدكتور ماركو. قم بتحليل الطلب بعمق وقدم تفاصيل دقيقة واحترافية."
});
// تمت إضافة نية "التحليل المعقد"
var IntentSchema = zod_1.z.object({
    intent: zod_1.z.enum(["CREATE_REMINDER", "STATISTICS", "MEDICAL_EMERGENCY", "COMPLEX_ANALYSIS", "GENERAL_CHAT"])
});
var ReminderSchema = zod_1.z.object({
    task: zod_1.z.string(),
    date: zod_1.z.string()
});
function transcribeAudio(audioBase64) {
    return __awaiter(this, void 0, void 0, function () {
        var res, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, chatModel.generateContent([
                            { text: "أنت ناسخ محترف. قم بتفريغ هذه الرسالة الصوتية إلى نص عربي دقيق جداً (باللهجة المصرية إن وجدت). اكتب النص فقط بدون أي تعليقات أو شروحات إضافية." },
                            { inlineData: { data: audioBase64, mimeType: "audio/ogg" } }
                        ])];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.response.text().trim()];
                case 2:
                    e_1 = _a.sent();
                    console.error("Audio Transcription Error:", e_1);
                    throw new Error("Failed to transcribe audio");
                case 3: return [2 /*return*/];
            }
        });
    });
}
function analyzeIntent(text) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt_1, res, parsed, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    prompt_1 = "\n\u0623\u0646\u062A \u0646\u0638\u0627\u0645 \u0641\u0631\u0632 \u0644\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A. \u062D\u062F\u062F \u0646\u064A\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 \u0627\u0644\u0646\u0635 \u0627\u0644\u062A\u0627\u0644\u064A \u0628\u062F\u0642\u0629.\n\u064A\u062C\u0628 \u0623\u0646 \u062A\u0639\u0648\u062F \u0628\u0640 JSON \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0645\u0641\u062A\u0627\u062D \"intent\" \u0628\u0648\u0627\u062D\u062F\u0629 \u0645\u0646 \u0627\u0644\u0642\u064A\u0645 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0641\u0642\u0637:\n\"CREATE_REMINDER\" (\u0644\u0625\u0636\u0627\u0641\u0629 \u0645\u0647\u0645\u0629 \u0623\u0648 \u062A\u0630\u0643\u064A\u0631)\n\"STATISTICS\" (\u0644\u0644\u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0639\u0646 \u062C\u062F\u0648\u0644 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0623\u0648 \u0645\u0647\u0627\u0645 \u0627\u0644\u064A\u0648\u0645)\n\"MEDICAL_EMERGENCY\" (\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0623\u0648 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629 \u0627\u0644\u062E\u0637\u064A\u0631\u0629)\n\"COMPLEX_ANALYSIS\" (\u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0637\u0644\u0628 \u0645\u0639\u0642\u062F\u0627\u064B \u062C\u062F\u0627\u064B \u0648\u064A\u062D\u062A\u0627\u062C \u062A\u062D\u0644\u064A\u0644\u0627\u064B \u0639\u0645\u064A\u0642\u0627\u064B\u060C \u0623\u0648 \u064A\u0637\u0644\u0628 \u0628\u062D\u062B\u0627\u064B \u0637\u0628\u064A\u0627\u064B \u0645\u0641\u0635\u0644\u0627\u064B\u060C \u0623\u0648 \u062A\u0631\u062C\u0645\u0629 \u0648\u0646\u0642\u0627\u0634\u0627\u062A \u0639\u0644\u0645\u064A\u0629 \u0637\u0648\u064A\u0644\u0629)\n\"GENERAL_CHAT\" (\u0644\u0644\u062F\u0631\u062F\u0634\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0628\u0633\u064A\u0637\u0629)\n\n\u0627\u0644\u0646\u0635: \"".concat(text, "\"\n        ");
                    return [4 /*yield*/, jsonModel.generateContent(prompt_1)];
                case 1:
                    res = _a.sent();
                    parsed = JSON.parse(res.response.text());
                    return [2 /*return*/, IntentSchema.parse(parsed)];
                case 2:
                    e_2 = _a.sent();
                    console.error("Intent Zod Validation Error:", e_2);
                    return [2 /*return*/, { intent: "GENERAL_CHAT" }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function chatGemini(text) {
    return __awaiter(this, void 0, void 0, function () {
        var res, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, chatModel.generateContent(text)];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.response.text()];
                case 2:
                    e_3 = _a.sent();
                    console.error("Gemini Chat Error:", e_3);
                    return [2 /*return*/, "عذراً يا دكتور، السيرفر مشغول حالياً."];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// 🚀 دالة المحادثة الخاصة بموديل برو
function chatProGemini(text) {
    return __awaiter(this, void 0, void 0, function () {
        var res, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, proModel.generateContent(text)];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.response.text()];
                case 2:
                    e_4 = _a.sent();
                    console.error("Gemini PRO Chat Error:", e_4);
                    throw e_4; // لنقم بالتقاط الخطأ في bot.ts لتحويله للفلاش كاحتياطي
                case 3: return [2 /*return*/];
            }
        });
    });
}
function parseReminder(text) {
    return __awaiter(this, void 0, void 0, function () {
        var now, prompt_2, res, parsed, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
                    prompt_2 = "\n\u0627\u0644\u0648\u0642\u062A \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0639\u0644\u064A \u0627\u0644\u0622\u0646 \u0647\u0648: ".concat(now, " \u0628\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0642\u0627\u0647\u0631\u0629.\n\u0627\u0633\u062A\u062E\u0631\u062C \u0627\u0644\u0645\u0647\u0645\u0629 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0628\u0635\u064A\u063A\u0629 JSON.\n\"task\": \u0648\u0635\u0641 \u0627\u0644\u0645\u0647\u0645\u0629.\n\"date\": \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0628\u0635\u064A\u063A\u0629 YYYY-MM-DD.\n\u0627\u0644\u0646\u0635: ").concat(text, "\n        ");
                    return [4 /*yield*/, jsonModel.generateContent(prompt_2)];
                case 1:
                    res = _a.sent();
                    parsed = JSON.parse(res.response.text());
                    return [2 /*return*/, ReminderSchema.parse(parsed)];
                case 2:
                    e_5 = _a.sent();
                    console.error("Gemini/Zod Parse Error:", e_5);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function generateStatsReply(text, todos) {
    return __awaiter(this, void 0, void 0, function () {
        var now, prompt_3, res, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    now = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
                    prompt_3 = "\n\u0627\u0644\u0648\u0642\u062A \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0641\u0639\u0644\u064A \u0627\u0644\u0622\u0646 \u0647\u0648: ".concat(now, " \u0628\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0642\u0627\u0647\u0631\u0629.\n\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u064A\u0633\u0623\u0644: \"").concat(text, "\"\n\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 (JSON): ").concat(JSON.stringify(todos), "\n\n\u0627\u0642\u0631\u0623 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u062B\u0645 \u0623\u062C\u0628 \u0639\u0644\u0649 \u0633\u0624\u0627\u0644\u0647 \u0628\u062F\u0642\u0629 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u064A\u0647\u0627 \u0628\u0623\u0633\u0644\u0648\u0628 \u0627\u062D\u062A\u0631\u0627\u0641\u064A \u0643\u0623\u0646\u0643 \u0633\u0643\u0631\u062A\u064A\u0631\u0647. \u0644\u0627 \u062A\u0630\u0643\u0631 \u0643\u0644\u0645\u0629 JSON.\n        ");
                    return [4 /*yield*/, chatModel.generateContent(prompt_3)];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.response.text()];
                case 2:
                    e_6 = _a.sent();
                    console.error("Gemini Stats Error:", e_6);
                    return [2 /*return*/, "عذراً يا دكتور، حدث خطأ أثناء قراءة جدول أعمالك."];
                case 3: return [2 /*return*/];
            }
        });
    });
}
