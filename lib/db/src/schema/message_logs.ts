import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageLogsTable = pgTable("message_logs", {
  id: serial("id").primaryKey(),
  guildName: text("guild_name"),
  channelName: text("channel_name").notNull(),
  authorUsername: text("author_username").notNull(),
  triggerMessage: text("trigger_message").notNull(),
  botResponse: text("bot_response").notNull(),
  ruleId: integer("rule_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageLogSchema = createInsertSchema(messageLogsTable).omit({ id: true, createdAt: true });
export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;
export type MessageLog = typeof messageLogsTable.$inferSelect;
