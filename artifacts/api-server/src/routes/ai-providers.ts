import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, aiProvidersTable } from "../lib/db";
import { eq } from "drizzle-orm";
import { invalidateCache } from "../lib/discord-bot";

const router: IRouter = Router();

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 6) + "••••••••" + key.slice(-4);
}

function toResponse(row: typeof aiProvidersTable.$inferSelect) {
  return { id: row.id, provider: row.provider, label: row.label, maskedKey: maskKey(row.keyValue), baseUrl: row.baseUrl, model: row.model, enabled: row.enabled, priority: row.priority, createdAt: row.createdAt.toISOString() };
}

router.get("/settings/ai-providers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(aiProvidersTable).orderBy(aiProvidersTable.priority, aiProvidersTable.createdAt);
  res.json(rows.map(toResponse));
});

router.post("/settings/ai-providers", async (req, res): Promise<void> => {
  const { provider, label, key, baseUrl, model, priority } = req.body as { provider?: string; label?: string; key?: string; baseUrl?: string; model?: string; priority?: number };
  if (!provider || !key?.trim() || !model?.trim()) { res.status(400).json({ error: "provider, key, dan model wajib diisi." }); return; }
  if (key.trim().length < 4) { res.status(400).json({ error: "API Key terlalu pendek." }); return; }

  const [row] = await db.insert(aiProvidersTable).values({ provider: provider.trim(), label: label?.trim() || null, keyValue: key.trim(), baseUrl: baseUrl?.trim() || null, model: model.trim(), priority: priority ?? 0 }).returning();
  invalidateCache();
  res.status(201).json(toResponse(row));
});

router.patch("/settings/ai-providers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID tidak valid." }); return; }
  const { label, enabled, model, priority } = req.body as { label?: string; enabled?: boolean; model?: string; priority?: number };
  const updateData: Record<string, unknown> = {};
  if (label !== undefined) updateData.label = label?.trim() || null;
  if (enabled !== undefined) updateData.enabled = enabled;
  if (model !== undefined) updateData.model = model.trim();
  if (priority !== undefined) updateData.priority = priority;

  const [row] = await db.update(aiProvidersTable).set(updateData).where(eq(aiProvidersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Provider tidak ditemukan." }); return; }
  invalidateCache();
  res.json(toResponse(row));
});

router.delete("/settings/ai-providers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID tidak valid." }); return; }
  const [row] = await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Provider tidak ditemukan." }); return; }
  invalidateCache();
  res.sendStatus(204);
});

router.post("/settings/ai-providers/:id/toggle", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID tidak valid." }); return; }
  const [existing] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Provider tidak ditemukan." }); return; }
  const [row] = await db.update(aiProvidersTable).set({ enabled: !existing.enabled }).where(eq(aiProvidersTable.id, id)).returning();
  invalidateCache();
  res.json(toResponse(row));
});

router.post("/settings/ai-providers/test", async (req, res): Promise<void> => {
  const { provider, key, baseUrl, model } = req.body as { provider?: string; key?: string; baseUrl?: string; model?: string };
  if (!provider || !key || !model) { res.status(400).json({ error: "provider, key, dan model wajib diisi." }); return; }

  try {
    if (provider === "gemini") {
      const client = new GoogleGenerativeAI(key);
      const gemModel = client.getGenerativeModel({ model });
      const result = await gemModel.generateContent("ping");
      const text = result.response.text();
      res.json({ ok: true, message: `Berhasil! Model merespons: "${text.slice(0, 50)}..."` });
    } else {
      const client = new OpenAI({ apiKey: key, baseURL: baseUrl || undefined, timeout: 10_000 });
      const completion = await client.chat.completions.create({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 10 });
      const text = completion.choices[0]?.message?.content ?? "(no response)";
      res.json({ ok: true, message: `Berhasil! Model merespons: "${text.slice(0, 50)}"` });
    }
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message ?? String(err);
    res.json({ ok: false, message: msg.length > 120 ? msg.slice(0, 120) + "..." : msg });
  }
});

export default router;
