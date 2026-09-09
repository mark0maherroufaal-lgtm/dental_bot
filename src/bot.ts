import { Bot } from "grammy";
import { setupGeneralCommands } from "./commands/general";
import { setupScienceCommands } from "./commands/science";
import { setupGamificationCommands } from "./commands/gamification";
import { setupTasksCommands } from "./commands/tasks";
import { setupCallbackHandlers } from "./handlers/callbacks";
import { setupMessageHandlers } from "./handlers/messages";

export const bot = new Bot(process.env.BOT_TOKEN!, {
    botInfo: {
        id: 8696849914,
        is_bot: true,
        first_name: "My Dental Secretary",
        username: "Marko_Dental_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        supports_guest_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
        has_topics_enabled: false,
        allows_users_to_create_topics: false,
        can_manage_bots: false,
        supports_join_request_queries: false
    }
});

bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});

setupGeneralCommands(bot);
setupScienceCommands(bot);
setupGamificationCommands(bot);
setupTasksCommands(bot);

setupCallbackHandlers(bot);
setupMessageHandlers(bot);
