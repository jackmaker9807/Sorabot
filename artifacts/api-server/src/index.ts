import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./lib/discord-bot";
import { initWss } from "./lib/ws";
import { initDb, getDbRefs } from "./lib/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
initWss(server);

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

initDb()
  .then(() => {
    server.listen(port, () => {
      logger.info({ port }, "Server listening");
      void autoStartBot();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize database");
    process.exit(1);
  });

async function autoStartBot() {
  try {
    const { db, botSettingsTable } = getDbRefs();
    const [settings] = await db.select().from(botSettingsTable).limit(1);
    const token = settings?.discordToken || process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      logger.info("Auto-start skipped: no Discord token configured");
      return;
    }
    logger.info("Auto-starting Discord bot...");
    await startBot();
    logger.info("Discord bot auto-started successfully");
  } catch (err) {
    logger.warn({ err }, "Auto-start bot failed (non-fatal)");
  }
}
