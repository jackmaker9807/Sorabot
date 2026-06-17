import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rulesTable = pgTable("rules", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  response: text("response").notNull(),
  matchType: text("match_type").notNull().default("contains"),
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  triggerCount: integer("trigger_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRuleSchema = createInsertSchema(rulesTable).omit({ id: true, triggerCount: true, createdAt: true });
export type InsertRule = z.infer<typeof insertRuleSchema>;
export type Rule = typeof rulesTable.$inferSelect;
