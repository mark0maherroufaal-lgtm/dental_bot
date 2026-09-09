import { webhookCallback } from "grammy";
import { bot } from "../src/bot";

// Vercel Serverless Function to handle Telegram Webhooks
export default webhookCallback(bot, "std/http");
