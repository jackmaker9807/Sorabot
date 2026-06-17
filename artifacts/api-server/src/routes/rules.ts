import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rulesTable, type RuleRow } from "../lib/db";

const router: IRouter = Router();

router.get("/rules", async (_req, res): Promise<void> => {
  const rules = await db.select().from(rulesTable).orderBy(rulesTable.createdAt);
  res.json(rules.map((r: RuleRow) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/rules", async (req, res): Promise<void> => {
  const { keyword, response, matchType, caseSensitive } = req.body as { keyword?: string; response?: string; matchType?: string; caseSensitive?: boolean };
  if (!keyword?.trim() || !response?.trim()) { res.status(400).json({ error: "keyword dan response wajib diisi." }); return; }

  const [rule] = await db.insert(rulesTable).values({
    keyword: keyword.trim(), response: response.trim(),
    matchType: matchType ?? "contains", caseSensitive: caseSensitive ?? false,
  }).returning();
  res.status(201).json({ ...rule, createdAt: rule.createdAt.toISOString() });
});

router.get("/rules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID tidak valid." }); return; }
  const [rule] = await db.select().from(rulesTable).where(eq(rulesTable.id, id));
  if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
  res.json({ ...rule, createdAt: rule.createdAt.toISOString() });
});

router.patch("/rules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID tidak valid." }); return; }

  const { keyword, response, matchType, caseSensitive, enabled } = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  if (keyword !== undefined) updateData.keyword = keyword;
  if (response !== undefined) updateData.response = response;
  if (matchType !== undefined) updateData.matchType = matchType;
  if (caseSensitive !== undefined) updateData.caseSensitive = caseSensitive;
  if (enabled !== undefined) updateData.enabled = enabled;

  const [rule] = await db.update(rulesTable).set(updateData).where(eq(rulesTable.id, id)).returning();
  if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
  res.json({ ...rule, createdAt: rule.createdAt.toISOString() });
});

router.delete("/rules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID tidak valid." }); return; }
  const [rule] = await db.delete(rulesTable).where(eq(rulesTable.id, id)).returning();
  if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
  res.sendStatus(204);
});

router.post("/rules/:id/toggle", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID tidak valid." }); return; }
  const [existing] = await db.select().from(rulesTable).where(eq(rulesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Rule not found" }); return; }
  const [rule] = await db.update(rulesTable).set({ enabled: !existing.enabled }).where(eq(rulesTable.id, id)).returning();
  res.json({ ...rule, createdAt: rule.createdAt.toISOString() });
});

export default router;
