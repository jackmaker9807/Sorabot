import { randomBytes } from "crypto";

const tokens = new Map<string, string>();

export function createToken(username: string): string {
  const token = randomBytes(32).toString("hex");
  tokens.set(token, username);
  return token;
}

export function validateToken(token: string): string | null {
  return tokens.get(token) ?? null;
}

export function revokeToken(token: string): void {
  tokens.delete(token);
}
