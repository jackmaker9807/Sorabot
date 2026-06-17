import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, botSettingsTable, aiProvidersTable } from "../lib/db";
import { invalidateCache } from "../lib/discord-bot";

const router: IRouter = Router();

async function ensureSettings() {
  const [existing] = await db.select().from(botSettingsTable).limit(1);
  if (!existing) { const [created] = await db.insert(botSettingsTable).values({}).returning(); return created; }
  return existing;
}

async function toResponse(settings: typeof botSettingsTable.$inferSelect) {
  const [result] = await db.select({ count: count() }).from(aiProvidersTable).where(eq(aiProvidersTable.enabled, true));
  const aiProviderCount = Number(result?.count ?? 0);
  return {
    id: settings.id,
    personality: settings.personality,
    aiEnabled: settings.aiEnabled,
    respondToAll: settings.respondToAll,
    mentionOnly: settings.mentionOnly,
    gifEnabled: settings.gifEnabled,
    gifCooldownSeconds: settings.gifCooldownSeconds,
    stickerEnabled: settings.stickerEnabled,
    hasDiscordToken: !!settings.discordToken,
    hasAiProviders: aiProviderCount > 0,
    aiProviderCount,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

router.get("/settings", async (req, res): Promise<void> => {
  try {
    const settings = await ensureSettings();
    res.json(await toResponse(settings));
  } catch (err) { req.log.error({ err }, "Failed to get settings"); res.status(500).json({ error: "Failed to get settings" }); }
});

router.patch("/settings", async (req, res): Promise<void> => {
  const { personality, aiEnabled, respondToAll, mentionOnly, discordToken, gifEnabled, gifCooldownSeconds, stickerEnabled } = req.body as Record<string, unknown>;
  try {
    const existing = await ensureSettings();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (personality !== undefined) updateData.personality = personality;
    if (aiEnabled !== undefined) updateData.aiEnabled = aiEnabled;
    if (respondToAll !== undefined) updateData.respondToAll = respondToAll;
    if (mentionOnly !== undefined) updateData.mentionOnly = mentionOnly;
    if (discordToken !== undefined) updateData.discordToken = discordToken || null;
    if (gifEnabled !== undefined) updateData.gifEnabled = gifEnabled;
    if (gifCooldownSeconds !== undefined) updateData.gifCooldownSeconds = Number(gifCooldownSeconds);
    if (stickerEnabled !== undefined) updateData.stickerEnabled = stickerEnabled;

    const [settings] = await db.update(botSettingsTable).set(updateData).where(eq(botSettingsTable.id, existing.id)).returning();
    invalidateCache();
    res.json(await toResponse(settings));
  } catch (err) { req.log.error({ err }, "Failed to update settings"); res.status(500).json({ error: "Failed to update settings" }); }
});

router.post("/settings/test", async (req, res): Promise<void> => {
  const { discordToken } = req.body as { discordToken?: string };
  const settings = await ensureSettings();
  const tokenToTest = discordToken || settings.discordToken || process.env.DISCORD_BOT_TOKEN || "";

  if (tokenToTest) {
    try {
      const r = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bot ${tokenToTest}` } });
      if (r.ok) {
        const data = await r.json() as { username?: string; discriminator?: string };
        res.json({ discord: { ok: true, message: `Terhubung sebagai ${data.username}#${data.discriminator}` } });
      } else {
        res.json({ discord: { ok: false, message: `Token tidak valid (HTTP ${r.status})` } });
      }
    } catch { res.json({ discord: { ok: false, message: "Gagal terhubung ke Discord" } }); }
  } else {
    res.json({ discord: { ok: false, message: "Token belum diatur" } });
  }
});

export default router;
