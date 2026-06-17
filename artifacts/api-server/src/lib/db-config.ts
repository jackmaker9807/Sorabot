import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

export type DbProvider = "postgres" | "sqlite";

export interface DbConfig {
  provider: DbProvider;
  postgresUrl?: string;
  sqliteUrl: string;
}

const CONFIG_PATH = resolve(process.cwd(), "data/db-config.json");

export const DEFAULT_CONFIG: DbConfig = {
  provider: "sqlite",
  sqliteUrl: "file:./data/sora.db",
};

export function readDbConfig(): DbConfig {
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) as Partial<DbConfig> };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeDbConfig(config: DbConfig): void {
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
