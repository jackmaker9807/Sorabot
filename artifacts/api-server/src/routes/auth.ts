import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, botSettingsTable } from "../lib/db";
import { eq } from "drizzle-orm";
import { createToken, revokeToken, validateToken } from "../lib/token-store";

const router: IRouter = Router();

const DEFAULT_PASSWORD = "admin";

async function getSettings() {
  const [s] = await db.select().from(botSettingsTable).limit(1);
  if (!s) {
    const [created] = await db.insert(botSettingsTable).values({}).returning();
    return created;
  }
  return s;
}

router.get("/auth/me", (req, res): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const username = validateToken(token);
    if (username) { res.json({ authenticated: true, username }); return; }
  }
  res.status(401).json({ authenticated: false });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) { res.status(400).json({ error: "Username dan password wajib diisi." }); return; }

  try {
    const settings = await getSettings();
    if (username !== settings.adminUsername) { res.status(401).json({ error: "Username atau password salah." }); return; }

    const isValid = settings.adminPasswordHash
      ? await bcrypt.compare(password, settings.adminPasswordHash)
      : password === DEFAULT_PASSWORD;

    if (!isValid) { res.status(401).json({ error: "Username atau password salah." }); return; }

    const token = createToken(username);
    res.json({ authenticated: true, username, token });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});

router.post("/auth/logout", (req, res): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) revokeToken(authHeader.slice(7));
  res.json({ ok: true });
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const currentUsername = token ? validateToken(token) : null;

  if (!currentUsername) { res.status(401).json({ error: "Tidak terautentikasi." }); return; }

  const { currentPassword, newPassword, newUsername } = req.body as { currentPassword?: string; newPassword?: string; newUsername?: string };
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "Password lama dan baru wajib diisi." }); return; }

  try {
    const settings = await getSettings();
    const isValid = settings.adminPasswordHash
      ? await bcrypt.compare(currentPassword, settings.adminPasswordHash)
      : currentPassword === DEFAULT_PASSWORD;

    if (!isValid) { res.status(401).json({ error: "Password lama salah." }); return; }

    const hash = await bcrypt.hash(newPassword, 10);
    const username = newUsername || settings.adminUsername;
    await db.update(botSettingsTable).set({ adminPasswordHash: hash, adminUsername: username, updatedAt: new Date() }).where(eq(botSettingsTable.id, settings.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Change password error");
    res.status(500).json({ error: "Terjadi kesalahan server." });
  }
});

export default router;
