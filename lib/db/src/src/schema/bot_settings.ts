import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const botSettingsTable = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  personality: text("personality").notNull().default("Kamu adalah asisten bot Discord yang ramah dan helpful. Balas pesan dengan natural, singkat, dan santai seperti orang sungguhan. Gunakan bahasa yang sama dengan pengguna (Indonesia atau Inggris). Jangan terlalu formal."),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  respondToAll: boolean("respond_to_all").notNull().default(true),
  mentionOnly: boolean("mention_only").notNull().default(false),
  gifEnabled: boolean("gif_enabled").notNull().default(false),
  gifCooldownSeconds: integer("gif_cooldown_seconds").notNull().default(60),
  stickerEnabled: boolean("sticker_enabled").notNull().default(false),
  discordToken: text("discord_token"),
  adminUsername: text("admin_username").notNull().default("admin"),
  adminPasswordHash: text("admin_password_hash"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BotSettings = typeof botSettingsTable.$inferSelect;
