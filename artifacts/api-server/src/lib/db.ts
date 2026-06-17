import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { readDbConfig } from "./db-config";
import { logger } from "./logger";

// ── SQLite schema (mirrors PG schema — same column names) ────────────────────

const rulesTableSqlite = sqliteTable("rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull(),
  response: text("response").notNull(),
  matchType: text("match_type").notNull().default("contains"),
  caseSensitive: integer("case_sensitive", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  triggerCount: integer("trigger_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const messageLogsTableSqlite = sqliteTable("message_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  guildName: text("guild_name"),
  channelName: text("channel_name").notNull(),
  authorUsername: text("author_username").notNull(),
  triggerMessage: text("trigger_message").notNull(),
  botResponse: text("bot_response").notNull(),
  ruleId: integer("rule_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const botSettingsTableSqlite = sqliteTable("bot_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personality: text("personality").notNull().default("Kamu adalah asisten bot Discord yang ramah dan helpful. Balas pesan dengan natural, singkat, dan santai seperti orang sungguhan. Gunakan bahasa yang sama dengan pengguna (Indonesia atau Inggris). Jangan terlalu formal."),
  aiEnabled: integer("ai_enabled", { mode: "boolean" }).notNull().default(true),
  respondToAll: integer("respond_to_all", { mode: "boolean" }).notNull().default(true),
  mentionOnly: integer("mention_only", { mode: "boolean" }).notNull().default(false),
  gifEnabled: integer("gif_enabled", { mode: "boolean" }).notNull().default(false),
  gifCooldownSeconds: integer("gif_cooldown_seconds").notNull().default(60),
  stickerEnabled: integer("sticker_enabled", { mode: "boolean" }).notNull().default(false),
  discordToken: text("discord_token"),
  adminUsername: text("admin_username").notNull().default("admin"),
  adminPasswordHash: text("admin_password_hash"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const aiProvidersTableSqlite = sqliteTable("ai_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull().default("gemini"),
  label: text("label"),
  keyValue: text("key_value").notNull(),
  baseUrl: text("base_url"),
  model: text("model").notNull().default("gemini-2.5-flash"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const userProfilesTableSqlite = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordUserId: text("discord_user_id").notNull().unique(),
  username: text("username").notNull(),
  nickname: text("nickname"),
  interests: text("interests"),
  communicationStyle: text("communication_style"),
  summary: text("summary"),
  messageCount: integer("message_count").notNull().default(0),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

const sqliteSchema = {
  rulesTable: rulesTableSqlite,
  messageLogsTable: messageLogsTableSqlite,
  botSettingsTable: botSettingsTableSqlite,
  aiProvidersTable: aiProvidersTableSqlite,
  userProfilesTable: userProfilesTableSqlite,
};

// ── SQLite auto-migration ────────────────────────────────────────────────────

function migrateSqlite(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL, response TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'contains',
      case_sensitive INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      trigger_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_name TEXT, channel_name TEXT NOT NULL,
      author_username TEXT NOT NULL, trigger_message TEXT NOT NULL,
      bot_response TEXT NOT NULL, rule_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personality TEXT NOT NULL DEFAULT 'Kamu adalah asisten bot Discord yang ramah dan helpful.',
      ai_enabled INTEGER NOT NULL DEFAULT 1, respond_to_all INTEGER NOT NULL DEFAULT 1,
      mention_only INTEGER NOT NULL DEFAULT 0, gif_enabled INTEGER NOT NULL DEFAULT 0,
      gif_cooldown_seconds INTEGER NOT NULL DEFAULT 60, sticker_enabled INTEGER NOT NULL DEFAULT 0,
      discord_token TEXT, admin_username TEXT NOT NULL DEFAULT 'admin',
      admin_password_hash TEXT, updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'gemini', label TEXT,
      key_value TEXT NOT NULL, base_url TEXT,
      model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
      enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT NOT NULL UNIQUE, username TEXT NOT NULL,
      nickname TEXT, interests TEXT, communication_style TEXT, summary TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

// ── Exported live bindings ────────────────────────────────────────────────────
// Initialised as SQLite placeholders; initDb() replaces them before the server
// starts listening, so route handlers always see the correct values.

// eslint-disable-next-line prefer-const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let db: any = null;
// eslint-disable-next-line prefer-const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let rulesTable: any = rulesTableSqlite;
// eslint-disable-next-line prefer-const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let messageLogsTable: any = messageLogsTableSqlite;
// eslint-disable-next-line prefer-const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let botSettingsTable: any = botSettingsTableSqlite;
// eslint-disable-next-line prefer-const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let aiProvidersTable: any = aiProvidersTableSqlite;
// eslint-disable-next-line prefer-const
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let userProfilesTable: any = userProfilesTableSqlite;

// ── Getter — always returns the current live references post-initDb ──────────

export function getDbRefs() {
  return { db, rulesTable, messageLogsTable, botSettingsTable, aiProvidersTable, userProfilesTable };
}

// ── initDb — called once before server.listen ────────────────────────────────

export async function initDb(): Promise<void> {
  const config = readDbConfig();
  logger.info({ provider: config.provider }, "Initializing database");

  if (config.provider === "sqlite") {
    const rawPath = config.sqliteUrl.replace(/^file:/, "");
    const resolvedPath = resolve(process.cwd(), rawPath);
    mkdirSync(dirname(resolvedPath), { recursive: true });

    const sqlite = new Database(resolvedPath);
    sqlite.pragma("journal_mode = WAL");
    migrateSqlite(sqlite);

    const sqliteDb = drizzleSqlite(sqlite, { schema: sqliteSchema });
    db = sqliteDb;
    rulesTable = rulesTableSqlite;
    messageLogsTable = messageLogsTableSqlite;
    botSettingsTable = botSettingsTableSqlite;
    aiProvidersTable = aiProvidersTableSqlite;
    userProfilesTable = userProfilesTableSqlite;

    logger.info({ path: resolvedPath }, "SQLite database ready");
  } else {
    // Set DATABASE_URL from config so @workspace/db can read it at load time
    if (config.postgresUrl) {
      process.env["DATABASE_URL"] = config.postgresUrl;
    }
    if (!process.env["DATABASE_URL"]) {
      throw new Error("PostgreSQL selected but no postgresUrl found in db-config.json and DATABASE_URL env var is not set.");
    }
    // Dynamically import @workspace/db only when PostgreSQL is configured
    // (avoids the DATABASE_URL check that runs at module-load time)
    const pgModule = await import("@workspace/db");
    db = pgModule.db;
    rulesTable = pgModule.rulesTable;
    messageLogsTable = pgModule.messageLogsTable;
    botSettingsTable = pgModule.botSettingsTable;
    aiProvidersTable = pgModule.aiProvidersTable;
    userProfilesTable = pgModule.userProfilesTable;

    // Auto-create tables if they don't exist yet
    await pgModule.pool.query(`
      CREATE TABLE IF NOT EXISTS rules (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL,
        response TEXT NOT NULL,
        match_type TEXT NOT NULL DEFAULT 'contains',
        case_sensitive BOOLEAN NOT NULL DEFAULT false,
        enabled BOOLEAN NOT NULL DEFAULT true,
        trigger_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS message_logs (
        id SERIAL PRIMARY KEY,
        guild_name TEXT,
        channel_name TEXT NOT NULL,
        author_username TEXT NOT NULL,
        trigger_message TEXT NOT NULL,
        bot_response TEXT NOT NULL,
        rule_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS bot_settings (
        id SERIAL PRIMARY KEY,
        personality TEXT NOT NULL DEFAULT 'Kamu adalah asisten bot Discord yang ramah dan helpful. Balas pesan dengan natural, singkat, dan santai seperti orang sungguhan. Gunakan bahasa yang sama dengan pengguna (Indonesia atau Inggris). Jangan terlalu formal.',
        ai_enabled BOOLEAN NOT NULL DEFAULT true,
        respond_to_all BOOLEAN NOT NULL DEFAULT true,
        mention_only BOOLEAN NOT NULL DEFAULT false,
        gif_enabled BOOLEAN NOT NULL DEFAULT false,
        gif_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
        sticker_enabled BOOLEAN NOT NULL DEFAULT false,
        discord_token TEXT,
        admin_username TEXT NOT NULL DEFAULT 'admin',
        admin_password_hash TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ai_providers (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'gemini',
        label TEXT,
        key_value TEXT NOT NULL,
        base_url TEXT,
        model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
        enabled BOOLEAN NOT NULL DEFAULT true,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        discord_user_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        nickname TEXT,
        interests TEXT,
        communication_style TEXT,
        summary TEXT,
        message_count INTEGER NOT NULL DEFAULT 0,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    logger.info("PostgreSQL database ready");
  }
}
