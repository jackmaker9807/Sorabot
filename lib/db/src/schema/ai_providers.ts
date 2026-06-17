import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const AI_PROVIDERS = ["gemini", "openai", "groq", "openrouter", "custom"] as const;
export type AiProviderType = typeof AI_PROVIDERS[number];

export const aiProvidersTable = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("gemini"),
  label: text("label"),
  keyValue: text("key_value").notNull(),
  baseUrl: text("base_url"),
  model: text("model").notNull().default("gemini-2.5-flash"),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiProvider = typeof aiProvidersTable.$inferSelect;
