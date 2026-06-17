# SoraBot

Discord AI Bot dengan Dashboard Web — kontrol penuh bot Discord kamu lewat antarmuka web tanpa perlu menyentuh kode.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — jalankan API server + bot (port 8080)
- `pnpm --filter @workspace/discord-bot run dev` — jalankan dashboard web (port 20320)
- `pnpm run typecheck` — full typecheck semua packages
- `pnpm run build` — typecheck + build semua packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks dan Zod schemas dari OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + WebSocket (ws)
- DB: SQLite (better-sqlite3) / PostgreSQL + Drizzle ORM
- Discord: discord.js v14
- AI: OpenAI SDK, Google Generative AI
- Frontend: React 19, Vite, Tailwind CSS, Wouter
- Validation: Zod, drizzle-zod
- API codegen: Orval (dari OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/` — Express API server + Discord bot + WebSocket
- `artifacts/discord-bot/` — React dashboard frontend
- `artifacts/api-server/data/db-config.json` — konfigurasi database (sqlite/postgres)
- `artifacts/api-server/data/sora.db` — SQLite database (dibuat otomatis)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (sumber kebenaran API)
- `lib/api-client-react/src/generated/` — React Query hooks (auto-generated)

## Architecture decisions

- SQLite by default, bisa ganti ke PostgreSQL via `db-config.json`
- DB binding diekspor sebagai `let` + `initDb()` untuk lazy initialization (SQLite/PG swap)
- Auth berbasis token sederhana (Bearer token), disimpan di localStorage
- WebSocket di `/ws` untuk realtime log streaming ke dashboard
- Setup wizard otomatis muncul saat `adminPasswordHash` masih null

## Product

- Login dashboard dengan akun admin
- Setup wizard pertama kali (buat akun, isi Discord token, konfigurasi AI provider)
- Kontrol bot (start/stop) dari dashboard
- Manajemen rules (keyword → respons otomatis)
- Log percakapan real-time via WebSocket
- Pengaturan bot (personality AI, mode respons, GIF/sticker)
- Multi AI provider dengan priority fallback (Gemini, OpenAI, OpenRouter, custom)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Selalu restart workflow `api-server` setelah mengubah source code (nodemon akan auto-rebuild)
- `db` di-export sebagai `let` — gunakan `getDbRefs()` di route handlers, bukan import langsung
- Setup wizard hanya muncul sekali (saat `adminPasswordHash` null)
- Default login: `admin` / `admin` (sebelum setup wizard dijalankan)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
