import { Router, type IRouter } from "express";
import pg from "pg";
import Database from "better-sqlite3";
import { readDbConfig, writeDbConfig, type DbProvider } from "../lib/db-config";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/database/config", (_req, res): void => {
  const config = readDbConfig();
  res.json({
    provider: config.provider,
    sqliteUrl: config.sqliteUrl,
    hasCustomPostgresUrl: !!config.postgresUrl,
  });
});

router.post("/database/config", (req, res): void => {
  const { provider, sqliteUrl, postgresUrl } = req.body as {
    provider?: string;
    sqliteUrl?: string;
    postgresUrl?: string;
  };

  if (!provider || !["postgres", "sqlite"].includes(provider)) {
    res.status(400).json({ error: "provider harus 'postgres' atau 'sqlite'" });
    return;
  }

  const current = readDbConfig();
  writeDbConfig({
    provider: provider as DbProvider,
    sqliteUrl: sqliteUrl ?? current.sqliteUrl,
    postgresUrl: postgresUrl || current.postgresUrl,
  });

  logger.info({ provider }, "Database config updated — restart required");
  res.json({ success: true, restartRequired: true });
});

router.post("/database/test", async (req, res): Promise<void> => {
  const { provider, sqliteUrl, postgresUrl } = req.body as {
    provider?: string;
    sqliteUrl?: string;
    postgresUrl?: string;
  };

  try {
    if (provider === "sqlite") {
      const rawPath = (sqliteUrl ?? "file:./data/sora.db").replace(/^file:/, "");
      const sqlite = new Database(rawPath, { readonly: false });
      sqlite.prepare("SELECT 1").get();
      sqlite.close();
      res.json({ ok: true, message: "SQLite dapat diakses ✓" });
    } else {
      const config = readDbConfig();
      const connectionString = postgresUrl ?? config.postgresUrl ?? process.env.DATABASE_URL;
      if (!connectionString) {
        res.json({ ok: false, message: "PostgreSQL URL tidak ditemukan" });
        return;
      }
      const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
      await pool.query("SELECT 1");
      await pool.end();
      res.json({ ok: true, message: "PostgreSQL terhubung ✓" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : "Koneksi gagal";
    logger.warn({ err }, "Database test failed");
    res.json({ ok: false, message });
  }
});

export default router;
