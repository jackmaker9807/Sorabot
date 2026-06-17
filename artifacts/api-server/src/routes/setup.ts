import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, botSettingsTable, aiProvidersTable } from "../lib/db";
import { startBot } from "../lib/discord-bot";

const router: IRouter = Router();

async function getSettings() {
  const [s] = await db.select().from(botSettingsTable).limit(1);
  if (!s) {
    const [created] = await db.insert(botSettingsTable).values({}).returning();
    return created;
  }
  return s;
}

router.get("/setup/status", async (req, res): Promise<void> => {
  try {
    const settings = await getSettings();
    const needsSetup = !settings.adminPasswordHash;
    res.json({ needsSetup });
  } catch (err) {
    req.log.error({ err }, "Failed to get setup status");
    res.status(500).json({ error: "Gagal memeriksa status setup." });
  }
});

router.post("/setup/complete", async (req, res): Promise<void> => {
  try {
    const settings = await getSettings();

    if (settings.adminPasswordHash) {
      res.status(403).json({ error: "Setup sudah selesai dilakukan sebelumnya." });
      return;
    }

    const {
      username,
      password,
      discordToken,
      aiProvider,
    } = req.body as {
      username?: string;
      password?: string;
      discordToken?: string;
      aiProvider?: {
        provider: string;
        label: string;
        keyValue: string;
        model: string;
        baseUrl?: string;
      };
    };

    if (!username || !password) {
      res.status(400).json({ error: "Username dan password wajib diisi." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password minimal 6 karakter." });
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    const updateData: Record<string, unknown> = {
      adminUsername: username,
      adminPasswordHash: hash,
      updatedAt: new Date(),
    };

    if (discordToken) {
      updateData.discordToken = discordToken;
    }

    await db.update(botSettingsTable).set(updateData);

    if (aiProvider && aiProvider.keyValue) {
      await db.insert(aiProvidersTable).values({
        provider: aiProvider.provider,
        label: aiProvider.label || aiProvider.provider,
        keyValue: aiProvider.keyValue,
        model: aiProvider.model,
        baseUrl: aiProvider.baseUrl || null,
        enabled: true,
        priority: 0,
      });
    }

    if (discordToken) {
      try {
        await startBot();
      } catch {
        req.log.warn("Setup complete tapi bot gagal auto-start. Bisa diaktifkan manual.");
      }
    }

    res.json({ ok: true, message: "Setup berhasil! Silakan login dengan kredensial baru." });
  } catch (err) {
    req.log.error({ err }, "Setup failed");
    res.status(500).json({ error: "Terjadi kesalahan saat setup." });
  }
});

export default router;
