"use strict";
// src/prompts_and_ai.ts (or src/gemini.ts)
// Stage 2 + Stage 6 Enhanced Vision OCR for Dental & Personal Receipts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderSchema = exports.IntentSchema = exports.DR_MARKO_SYSTEM_PROMPT = void 0;
exports.stripThinkingTags = stripThinkingTags;
exports.cleanJsonString = cleanJsonString;
exports.executeTextModelWithFallback = executeTextModelWithFallback;
exports.chatMainGemini = chatMainGemini;
exports.chatPatientGemini = chatPatientGemini;
exports.chatGemini = chatGemini;
exports.chatProGemini = chatProGemini;
exports.analyzeIntent = analyzeIntent;
exports.parseReminder = parseReminder;
exports.generateStatsReply = generateStatsReply;
exports.transcribeAudio = transcribeAudio;
exports.processReceiptImage = processReceiptImage;
const generative_ai_1 = require("@google/generative-ai");
const groq_sdk_1 = require("groq-sdk");
const zod_1 = require("zod");
const config_1 = require("./core/config");
const errors_1 = require("./core/errors");
const timezone_1 = require("./core/timezone");
const supabase_1 = require("./supabase");
let _genAI = null;
let _groq = null;
function getGenAI(useProKey = false) {
    const key = useProKey
        ? config_1.config.GEMINI_PRO_API_KEY || config_1.config.GEMINI_API_KEY
        : config_1.config.GEMINI_API_KEY;
    if (!key) {
        throw new errors_1.GeminiError("GEMINI_API_KEY is not configured.");
    }
    if (!_genAI || useProKey) {
        return new generative_ai_1.GoogleGenerativeAI(key);
    }
    return _genAI;
}
function getGroq() {
    if (!config_1.config.GROQ_API_KEY) {
        throw new errors_1.GroqError("GROQ_API_KEY is not configured.");
    }
    if (!_groq) {
        _groq = new groq_sdk_1.Groq({ apiKey: config_1.config.GROQ_API_KEY });
    }
    return _groq;
}
// ==========================================
// Strict Egyptian Arabic Persona for Dr. Marko
// ==========================================
exports.DR_MARKO_SYSTEM_PROMPT = `أنت السكرتير والمساعد الشخصي الذكي الخاص بـ "دكتور ماركو ماهر" (طالب طب أسنان في سنة تالتة بمصر).
أنت بتكلمه هو شخصياً ومباشرةً زي صاحبه الذكي اللي فاهمه وحافظ جدوله ومهامه ومصاريفه.

قواعد صارمة لا يمكن كسرها أبداً:
1. اتكلم دايماً بلهجة مصرية طبيعية وودودة وعملية (مش فصحى، ومش رسمي زيادة).
2. ردودك لازم تكون قصيرة ومباشرة وعملية جداً (3 إلى 4 سطور بحد أقصى إلا لو طلب منك شرح مفصل).
3. ممنوع منعاً باتاً تقول "أنا مساعدك الذكي وأقدر أساعدك في..." أو تشرح مميزاتك وإمكانياتك من غير ما يسألك صراحةً.
4. ممنوع تماماً تأليف أو اختراع أي مهام، محاضرات، مواعيد، نقاط XP، أو مصاريف مش موجودة في [بيانات د. ماركو الحقيقية من الداتابيز الآن] المرفقة معاك.
5. لو سألك عن مهامه أو جدوله النهارده وكانت القائمة فاضية في الداتابيز، قوله بتشجيع "جدولك فاضي النهارده ✨" ومتألفش أي مهام.
6. أنت مش مخصص للمرضى أبداً؛ كلامك كله موجه لدكتور ماركو نفسه كزميل ومساعد شخصي ليه في الكلية وحياته اليومية.`;
// ==========================================
// Output Sanitizers (Thinking Tags & JSON)
// ==========================================
function stripThinkingTags(rawText) {
    if (!rawText)
        return "";
    return rawText
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<\/?think>/gi, "")
        .trim();
}
function cleanJsonString(rawText) {
    const withoutThink = stripThinkingTags(rawText);
    const fencedMatch = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : withoutThink.trim();
    const firstBrace = candidate.indexOf("{");
    const firstBracket = candidate.indexOf("[");
    let startIdx = -1;
    let endChar = "}";
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIdx = firstBrace;
        endChar = "}";
    }
    else if (firstBracket !== -1) {
        startIdx = firstBracket;
        endChar = "]";
    }
    if (startIdx !== -1) {
        const lastIdx = candidate.lastIndexOf(endChar);
        if (lastIdx > startIdx) {
            return candidate.slice(startIdx, lastIdx + 1);
        }
    }
    return candidate;
}
async function runSingleCandidate(candidate, prompt, options = {}) {
    const { systemInstruction = exports.DR_MARKO_SYSTEM_PROMPT, history = [], jsonMode = false, maxTokens = 800, temperature = jsonMode ? 0.1 : 0.5, useProKey = false } = options;
    if (candidate.provider === "gemini") {
        const genAI = getGenAI(useProKey);
        const model = genAI.getGenerativeModel({
            model: candidate.model,
            systemInstruction
        });
        const generationConfig = {
            temperature,
            maxOutputTokens: maxTokens
        };
        if (jsonMode) {
            generationConfig.responseMimeType = "application/json";
        }
        if (history.length > 0 && !jsonMode) {
            const formattedHistory = history
                .filter((h) => h.content && h.content.trim().length > 0)
                .map((h) => ({
                role: h.role === "assistant" || h.role === "model" ? "model" : "user",
                parts: [{ text: h.content }]
            }));
            const chat = model.startChat({
                history: formattedHistory,
                generationConfig
            });
            const result = await chat.sendMessage(prompt);
            return stripThinkingTags(result.response.text());
        }
        else {
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig
            });
            return stripThinkingTags(result.response.text());
        }
    }
    else {
        const groq = getGroq();
        const messages = [{ role: "system", content: systemInstruction }];
        for (const h of history) {
            if (!h.content?.trim())
                continue;
            messages.push({
                role: h.role === "model" || h.role === "assistant" ? "assistant" : "user",
                content: h.content
            });
        }
        messages.push({ role: "user", content: prompt });
        const reqPayload = {
            model: candidate.model,
            messages,
            max_tokens: maxTokens,
            temperature
        };
        if (jsonMode) {
            reqPayload.response_format = { type: "json_object" };
        }
        if (candidate.model.toLowerCase().includes("qwen3")) {
            reqPayload.reasoning_effort = "none";
        }
        const response = await groq.chat.completions.create(reqPayload);
        const content = response.choices[0]?.message?.content || "";
        if (!content.trim()) {
            throw new errors_1.GroqError(`Empty response from Groq model ${candidate.model}`);
        }
        return stripThinkingTags(content);
    }
}
async function executeTextModelWithFallback(taskType, prompt, options = {}) {
    const candidates = config_1.MODEL_REGISTRY[taskType] || config_1.MODEL_REGISTRY.MAESTRO_FAST;
    let lastError = null;
    for (const candidate of candidates) {
        if (candidate.provider === "gemini" && !config_1.config.GEMINI_API_KEY)
            continue;
        if (candidate.provider === "groq" && !config_1.config.GROQ_API_KEY)
            continue;
        try {
            return await runSingleCandidate(candidate, prompt, options);
        }
        catch (err) {
            lastError = err;
            console.warn(`[AI Fallback] Model "${candidate.provider}:${candidate.model}" failed for ${taskType}: ${err?.message || err}. Trying next candidate...`);
        }
    }
    throw new errors_1.GeminiError(`All models in fallback chain failed for task ${taskType}`, lastError);
}
// ==========================================
// Core Exported Chat Functions
// ==========================================
async function chatMainGemini(text, history = []) {
    try {
        const contextHeader = (0, timezone_1.getCairoContextHeader)();
        const snapshot = await (0, supabase_1.getLiveDbSnapshot)(config_1.config.ADMIN_ID);
        const snapshotBlock = (0, supabase_1.formatSnapshotForPrompt)(snapshot);
        const fullSystemPrompt = `${exports.DR_MARKO_SYSTEM_PROMPT}\n\n${contextHeader}\n${snapshotBlock}`;
        return await executeTextModelWithFallback("MAESTRO_FAST", text, {
            systemInstruction: fullSystemPrompt,
            history,
            maxTokens: 600
        });
    }
    catch (e) {
        console.error("[AI] chatMainGemini error:", e);
        return "معلش يا دكتور، السيرفر مهنج لحظة واحدة، ابعتها تاني كده؟";
    }
}
async function chatPatientGemini(text, history = []) {
    return chatGemini(text, history);
}
async function chatGemini(text, history = []) {
    try {
        const contextHeader = (0, timezone_1.getCairoContextHeader)();
        const snapshot = await (0, supabase_1.getLiveDbSnapshot)(config_1.config.ADMIN_ID);
        const snapshotBlock = (0, supabase_1.formatSnapshotForPrompt)(snapshot);
        const groundedSystemPrompt = `${exports.DR_MARKO_SYSTEM_PROMPT}\n\n${contextHeader}\n${snapshotBlock}`;
        return await executeTextModelWithFallback("CHAT_EGYPTIAN", text, {
            systemInstruction: groundedSystemPrompt,
            history,
            maxTokens: 600,
            temperature: 0.5
        });
    }
    catch (e) {
        console.error("[AI] chatGemini error:", e);
        return "حصلت لخبطة سريعة في الشبكة يا دكتور، جرب تبعتها تاني.";
    }
}
async function chatProGemini(text, history = []) {
    const contextHeader = (0, timezone_1.getCairoContextHeader)();
    const snapshot = await (0, supabase_1.getLiveDbSnapshot)(config_1.config.ADMIN_ID);
    const snapshotBlock = (0, supabase_1.formatSnapshotForPrompt)(snapshot);
    const proSystemPrompt = `${exports.DR_MARKO_SYSTEM_PROMPT}\n\nأنت الآن في وضع التحليل العميق والتخطيط الدراسي/المالي لدكتور ماركو. قدم إجابة منظمة وواضحة وعملية.\n\n${contextHeader}\n${snapshotBlock}`;
    const quota = await (0, supabase_1.tryConsumeProQuota)(config_1.config.DAILY_PRO_LIMIT);
    if (!quota.allowed) {
        console.warn(`[AI Pro Quota] Daily limit (${quota.limit}) reached (${quota.usedCount}). Falling back to VISION_AND_SCHEDULE.`);
        return executeTextModelWithFallback("VISION_AND_SCHEDULE", text, {
            systemInstruction: proSystemPrompt,
            history,
            maxTokens: 1200,
            temperature: 0.4
        });
    }
    return executeTextModelWithFallback("DEEP_ANALYSIS", text, {
        systemInstruction: proSystemPrompt,
        history,
        maxTokens: 1500,
        temperature: 0.4,
        useProKey: true
    });
}
// ==========================================
// Intent Detection & Reminder Parsing
// ==========================================
exports.IntentSchema = zod_1.z.object({
    intent: zod_1.z.enum([
        "CREATE_REMINDER",
        "CANCEL_TASK",
        "RESCHEDULE_TASK",
        "STATISTICS",
        "MEDICAL_EMERGENCY",
        "COMPLEX_ANALYSIS",
        "COLLEGE_SCHEDULE",
        "EXPENSE",
        "ACADEMIC_EVENT",
        "ARTICLE_SUMMARY",
        "GENERAL_CHAT"
    ])
});
async function analyzeIntent(text) {
    try {
        const prompt = `${(0, timezone_1.getCairoContextHeader)()}

صنّف رسالة دكتور ماركو التالية إلى نية واحدة فقط من القائمة:
- "CREATE_REMINDER": طلب تذكير أو إضافة مهمة للمذاكرة أو الكلية أو الحياة اليومية.
- "CANCEL_TASK": إلغاء أو مسح مهمة أو تذكير.
- "RESCHEDULE_TASK": تأجيل أو تعديل ميعاد مهمة.
- "STATISTICS": سؤال عن مهام اليوم، الجدول النهارده، الإحصائيات، الإنجازات، أو نقاط الـ XP.
- "EXPENSE": تسجيل مصروف أو دفع فلوس أو شراء أكل/مواصلات/أدوات أسنان.
- "COLLEGE_SCHEDULE": إرسال جدول محاضرات أو سكاشن الكلية لتحديثه.
- "ACADEMIC_EVENT": إخبار عن امتحان أو كويز أو تسليم قادم.
- "COMPLEX_ANALYSIS": طلب خطة مذاكرة مفصلة، تحليل ميزانية معقد، أو شرح علمي عميق في طب الأسنان.
- "GENERAL_CHAT": دردشة عامة، سلام، أو سؤال سريع لا يندرج تحت ما سبق.

الرسالة: "${text}"

أرجع JSON فقط بهذا الشكل:
{"intent": "اسم_النية"}`;
        const raw = await executeTextModelWithFallback("MAESTRO_FAST", prompt, {
            systemInstruction: "You are a fast, accurate JSON intent classifier for an Egyptian dental student's personal assistant. Return ONLY valid JSON.",
            jsonMode: true,
            maxTokens: 150,
            temperature: 0.0
        });
        const parsed = JSON.parse(cleanJsonString(raw));
        return exports.IntentSchema.parse(parsed);
    }
    catch (e) {
        console.error("[AI] analyzeIntent error:", e);
        return { intent: "GENERAL_CHAT" };
    }
}
exports.ReminderSchema = zod_1.z.object({
    task: zod_1.z.string().min(1),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    time: zod_1.z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:MM")
        .nullable(),
    action: zod_1.z.enum(["CREATE", "EDIT", "RESCHEDULE", "CANCEL"]),
    category: zod_1.z.string().optional().default("COLLEGE_STUDY"),
    priority: zod_1.z.enum(["Critical", "High", "Medium", "Low"]).optional().default("Medium"),
    course_keyword: zod_1.z.string().nullable().optional()
});
async function parseReminder(text) {
    try {
        const cairoHeader = (0, timezone_1.getCairoContextHeader)();
        const todayStr = (0, timezone_1.getCurrentDateStr)();
        const tomorrowStr = (0, timezone_1.getTomorrowDateStr)();
        const prompt = `${cairoHeader}

استخرج تفاصيل المهمة أو التذكير من رسالة د. ماركو التالية:
النص: "${text}"

القواعد الصارمة:
1. "task": اسم المهمة الصافي بدون كلمات الأمر.
2. "date": التاريخ بصيغة YYYY-MM-DD بناءً على [خريطة الأسبوع القادم] المرفقة أعلاه. (النهارده=${todayStr}، بكره/غداً=${tomorrowStr}).
3. "time": الوقت بصيغة 24 ساعة HH:MM، أو null إذا لم يذكر وقتاً محدداً. ممنوع تأليف وقت!
4. "action": "CREATE" أو "CANCEL" أو "RESCHEDULE".
5. "course_keyword": إذا طلب التذكير "قبل سكشن كذا" أو "قبل محاضرة كذا" بدون تحديد ساعة، ضع اسم المادة هنا (مثل "Operative" أو "الأوبرا")، وإلا اجعله null.

أرجع JSON فقط.`;
        const raw = await executeTextModelWithFallback("MAESTRO_FAST", prompt, {
            systemInstruction: "You are a precise Arabic/English temporal entity extractor. Return ONLY valid JSON matching the requested schema.",
            jsonMode: true,
            maxTokens: 300,
            temperature: 0.0
        });
        const parsed = JSON.parse(cleanJsonString(raw));
        if (parsed && typeof parsed.time === "string") {
            const norm = (0, timezone_1.normalizeTimeStr)(parsed.time);
            parsed.time = norm ? norm.slice(0, 5) : null;
        }
        return exports.ReminderSchema.parse(parsed);
    }
    catch (e) {
        console.error("[AI] parseReminder error:", e);
        return null;
    }
}
async function generateStatsReply(_text, statsData) {
    try {
        const tasks = statsData?.today_tasks ||
            statsData?.tasks ||
            statsData?.pendingTasksToday ||
            [];
        const totalXp = statsData?.total_xp ??
            statsData?.totalXp ??
            0;
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return totalXp > 0
                ? `جدولك فاضي النهارده ✨\n⭐ رصيدك الحالي: ${totalXp} XP`
                : `جدولك فاضي النهارده ✨`;
        }
        const lines = [`📋 **مهامك النهارده (${tasks.length}):**`];
        for (const t of tasks) {
            const isDone = t.status === "completed";
            const statusIcon = isDone ? "✅" : "⏳";
            const timePart = t.time ? ` — 🕒 ${(0, timezone_1.formatTimeToArabic12h)(t.time)}` : "";
            lines.push(`${statusIcon} ${t.title}${timePart}`);
        }
        if (totalXp > 0) {
            lines.push(`\n⭐ إجمالي نقاطك: **${totalXp} XP**`);
        }
        return lines.join("\n");
    }
    catch (e) {
        console.error("[AI] generateStatsReply error:", e);
        return "جدولك فاضي النهارده ✨";
    }
}
async function transcribeAudio(audioBase64, mimeType = "audio/ogg") {
    const candidates = config_1.MODEL_REGISTRY.VOICE_TRANSCRIBE;
    let lastError = null;
    for (const candidate of candidates) {
        try {
            if (candidate.provider === "groq" && config_1.config.GROQ_API_KEY) {
                const groq = getGroq();
                const buffer = Buffer.from(audioBase64, "base64");
                const file = await groq_sdk_1.Groq.toFile(buffer, "voice.ogg", {
                    type: mimeType
                });
                const transcription = await groq.audio.transcriptions.create({
                    file,
                    model: candidate.model,
                    language: "ar",
                    prompt: "رسالة صوتية باللهجة المصرية من دكتور ماركو طالب طب أسنان تتضمن مهام ومواعيد ومواد مثل Anatomy, Operative, Endo, Prostho, Pharma, Surgery وخامات مثل بيرات، كونترا، ألجينات، أسنان أكليريك، كاست، ومصاريف بالجنيه."
                });
                const text = transcription?.text?.trim();
                if (text)
                    return text;
                throw new errors_1.GroqError("Empty transcription from Groq Whisper");
            }
            if (candidate.provider === "gemini" && config_1.config.GEMINI_API_KEY) {
                const model = getGenAI().getGenerativeModel({
                    model: candidate.model
                });
                const prompt = "فرّغ هذه الرسالة الصوتية بدقة كما قيلت (باللهجة المصرية ومصطلحات طب الأسنان بالإنجليزية إن وجدت). أرجع النص المفرغ فقط بدون أي إضافات.";
                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            mimeType,
                            data: audioBase64
                        }
                    }
                ]);
                const text = stripThinkingTags(result.response.text()).trim();
                if (text)
                    return text;
                throw new errors_1.GeminiError("Empty transcription from Gemini Audio");
            }
        }
        catch (err) {
            lastError = err;
            console.warn(`[Voice Fallback] "${candidate.provider}:${candidate.model}" failed: ${err?.message || err}`);
        }
    }
    console.error("[AI] Audio Transcription failed across all models:", lastError);
    throw new errors_1.GeminiError("❌ مش قادر أفهم الصوت، ممكن تكتب؟", lastError);
}
// ==========================================
// Stage 6 Upgraded Receipt & Dental Lab Vision OCR
// ==========================================
async function processReceiptImage(imageBase64, mimeType = "image/jpeg") {
    const candidates = config_1.MODEL_REGISTRY.VISION_AND_SCHEDULE;
    let lastError = null;
    const prompt = `اقرأ صورة الفاتورة أو الإيصال أو إيصال الدفع دي بدقة عالية لدكتور ماركو (طالب طب أسنان سنة 3).
استخرج منها المعلومات التالية بوضوح:
1. المبلغ الإجمالي المدفوع (Total Amount) والعملة (افتراضياً EGP).
2. التصنيف الدقيق:
   - لو الفاتورة فيها مستلزمات أو خامات طب أسنان أو معمل (مثل: أدوات أسنان، بيرات/Burs، كونترا/Contra، ألجينات/Alginate، أسنان أكليريك/Acrylic teeth، كاست/Cast، أمالجم، كومبوزيت، فايلات إندو، جبس، شمع، حساب معمل أسنان) صنفها فوراً: "أدوات أسنان".
   - غير كده صنفها: "أكل" أو "كافيه" أو "مواصلات" أو "دراسة وكورسات" أو "شخصي".
3. تفاصيل الأصناف المشتراة باختصار (مثلاً: "بيرات وألجينات" أو "وجبة فراخ").
4. اسم المحل أو الشركة أو معمل الأسنان (Merchant) لو مكتوب.
5. طريقة الدفع (Cash / InstaPay / Vodafone Cash / Visa) لو ظاهرة.

اكتب النتيجة في سطرين مباشرين باللهجة المصرية يحتويان على المبلغ الرقمي، الفئة، الأصناف، واسم المحل/المعمل (مثال: "صرفت 250 EGP أدوات أسنان - بيرات وأسنان أكليريك من معمل النور نقدي").`;
    for (const candidate of candidates) {
        if (candidate.provider !== "gemini" || !config_1.config.GEMINI_API_KEY)
            continue;
        try {
            const model = getGenAI().getGenerativeModel({
                model: candidate.model
            });
            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType,
                        data: imageBase64
                    }
                }
            ]);
            const text = stripThinkingTags(result.response.text()).trim();
            if (text)
                return text;
        }
        catch (err) {
            lastError = err;
            console.warn(`[Vision Fallback] "${candidate.model}" failed: ${err?.message || err}`);
        }
    }
    console.error("[AI] Image Processing Error across all models:", lastError);
    throw new errors_1.GeminiError("فشل في تحليل صورة الفاتورة.", lastError);
}
