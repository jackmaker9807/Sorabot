import { Router, type IRouter } from "express";
import { getBotStatus, startBot, stopBot, getGuilds } from "../lib/discord-bot";
import { broadcast } from "../lib/ws";
import { db, rulesTable, messageLogsTable } from "../lib/db";
import { eq, count, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/bot/status", async (_req, res): Promise<void> => {
  res.json(getBotStatus());
});

router.get("/bot/guilds", (_req, res): void => {
  res.json(getGuilds());
});

router.post("/bot/toggle", async (req, res): Promise<void> => {
  const { running } = req.body as { running?: boolean };
  if (typeof running !== "boolean") { res.status(400).json({ error: "running must be boolean" }); return; }

  try {
    if (running) await startBot();
    else await stopBot();
    const status = getBotStatus();
    broadcast({ type: "bot_status", data: status });
    res.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Failed to toggle bot");
    res.status(500).json({ error: message });
  }
});

router.get("/stats", async (req, res): Promise<void> => {
  try {
    const [totalRepliesResult] = await db.select({ count: count() }).from(messageLogsTable);
    const [activeRulesResult] = await db.select({ count: count() }).from(rulesTable).where(eq(rulesTable.enabled, true));
    const [totalRulesResult] = await db.select({ count: count() }).from(rulesTable);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [todayRepliesResult] = await db.select({ count: count() }).from(messageLogsTable).where(sql`${messageLogsTable.createdAt} >= ${todayStart}`);

    res.json({
      totalReplies: totalRepliesResult?.count ?? 0,
      activeRules: activeRulesResult?.count ?? 0,
      totalRules: totalRulesResult?.count ?? 0,
      todayReplies: todayRepliesResult?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
