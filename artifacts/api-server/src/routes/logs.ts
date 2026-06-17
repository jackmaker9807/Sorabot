import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, messageLogsTable } from "../lib/db";

const router: IRouter = Router();

router.get("/logs", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const logs = await db.select().from(messageLogsTable).orderBy(desc(messageLogsTable.createdAt)).limit(limit).offset(offset);
  res.json(logs.map((l) => ({ ...l, guildName: l.guildName ?? null, ruleId: l.ruleId ?? null, createdAt: l.createdAt.toISOString() })));
});

export default router;
