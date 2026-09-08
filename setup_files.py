import os

base_dir = r"C:\Users\hp\.gemini\antigravity\scratch\dental_bot_vercel"
os.makedirs(base_dir, exist_ok=True)
os.makedirs(os.path.join(base_dir, "api"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "src"), exist_ok=True)

files = {
    "package.json": """{
  "name": "dr-marko-bot",
  "version": "2.0.0",
  "scripts": { "build": "tsc" },
  "dependencies": {
    "@google/generative-ai": "^0.2.1",
    "@supabase/supabase-js": "^2.39.7",
    "grammy": "^1.21.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.16",
    "@vercel/node": "^3.0.1",
    "typescript": "^5.3.3"
  }
}""",
    "tsconfig.json": """{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*", "api/**/*"]
}""",
    "vercel.json": """{
  "version": 2,
  "builds": [{ "src": "api/**/*.ts", "use": "@vercel/node" }],
  "routes": [
    { "src": "/webhook", "dest": "/api/bot.ts" },
    { "src": "/cron", "dest": "/api/cron.ts" }
  ],
  "crons": [{ "path": "/cron", "schedule": "*/5 * * * *" }]
}""",
    "src/supabase.ts": """import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export async function addTodo(task: string, dueDate: string, userId: string) {
    await supabase.from('todos').insert([{ task, due_date: dueDate, user_id: userId, status: 'open' }]);
}
""",
    "src/gemini.ts": """import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export async function chatGemini(text: string) {
    const res = await model.generateContent("أنت سكرتير طبي لدكتور ماركو. أجب باختصار.\\n\\n" + text);
    return res.response.text();
}
export async function parseReminder(text: string) {
    const res = await model.generateContent(`استخرج المهمة والتاريخ بصيغة JSON {"task": "...", "date": "YYYY-MM-DD"}. النص: ${text}`);
    try {
        const t = res.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(t);
    } catch(e) { return null; }
}
""",
    "src/bot.ts": """import { Bot } from "grammy";
import { chatGemini, parseReminder } from "./gemini";
import { addTodo } from "./supabase";
export const bot = new Bot(process.env.BOT_TOKEN!);
bot.command("start", (ctx) => ctx.reply("أهلاً دكتور ماركو! البوت السحابي يعمل بكفاءة 🚀"));
bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.includes("فكرني") || text.includes("ذكرني")) {
        const parsed = await parseReminder(text);
        if (parsed) {
            await addTodo(parsed.task, parsed.date, String(ctx.from?.id));
            return ctx.reply(`✅ تم الجدولة:\\nالمهمة: ${parsed.task}\\nالتاريخ: ${parsed.date}`);
        }
    }
    await ctx.replyWithChatAction("typing");
    ctx.reply(await chatGemini(text));
});
""",
    "api/bot.ts": """import { webhookCallback } from "grammy";
import { bot } from "../src/bot";
export default webhookCallback(bot, "std/http");
""",
    "api/cron.ts": """export default async function handler(req: any, res: any) {
    console.log("Cron executed");
    res.status(200).json({ status: "ok" });
}"""
}

for path, content in files.items():
    full_path = os.path.join(base_dir, path)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Created all Vercel bot files locally.")
