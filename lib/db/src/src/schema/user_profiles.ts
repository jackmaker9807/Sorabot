import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  discordUserId: text("discord_user_id").notNull().unique(),
  username: text("username").notNull(),
  nickname: text("nickname"),
  interests: text("interests"),
  communicationStyle: text("communication_style"),
  summary: text("summary"),
  messageCount: integer("message_count").notNull().default(0),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
