<div align="center">

# 🌸 SoraBot

**Discord AI Bot dengan Dashboard Web**

SoraBot adalah bot Discord berbasis AI yang bisa dikonfigurasi sepenuhnya lewat dashboard web — tanpa perlu menyentuh kode sama sekali.

[![Node.js](https://img.shields.io/badge/Node.js-24-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://typescriptlang.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord)](https://discord.js.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)

</div>

---

## ✨ Fitur

- 🤖 **Bot Discord AI** — Membalas pesan secara otomatis menggunakan AI (Gemini, OpenAI, OpenRouter, atau custom)
- 📋 **Manajemen Rules** — Buat aturan keyword → respons tanpa perlu coding
- 🧠 **User Profiling** — Bot mengingat kepribadian dan kebiasaan tiap pengguna
- 📊 **Log Percakapan** — Pantau semua interaksi bot secara real-time
- 🎛️ **Dashboard Web** — Kontrol penuh lewat antarmuka yang intuitif
- 🔄 **Multi AI Provider** — Dukung banyak provider dengan priority fallback
- 🖼️ **GIF & Sticker** — Bisa kirim GIF/sticker sebagai respons (opsional)
- 🔐 **Setup Wizard** — Panduan instalasi langkah demi langkah untuk server baru

---

## 🚀 Cara Instalasi

### Prasyarat

- [Node.js](https://nodejs.org) v20 atau lebih baru
- [pnpm](https://pnpm.io) v9 atau lebih baru (`npm install -g pnpm`)

### Langkah Instalasi

```bash
# 1. Clone repository
git clone https://github.com/jackmaker9807/Sorabot.git
cd Sorabot

# 2. Install dependencies
pnpm install

# 3. Jalankan API server (terminal pertama)
pnpm --filter @workspace/api-server run dev

# 4. Jalankan dashboard (terminal kedua)
pnpm --filter @workspace/discord-bot run dev
```

Buka browser ke `http://localhost:20320` — wizard instalasi akan muncul otomatis.

---

## 🧙 Wizard Instalasi

Saat pertama kali dijalankan di server baru, SoraBot akan menampilkan **wizard instalasi** yang memandu kamu melalui:

1. **Buat Akun Admin** — Username dan password untuk akses dashboard
2. **Discord Bot Token** — Token dari Discord Developer Portal
3. **AI Provider** — Pilih dan konfigurasi Gemini, OpenAI, dll.

Setelah wizard selesai, kamu bisa langsung masuk ke dashboard dan mulai menggunakan bot.

---

## 🔑 Mendapatkan Discord Bot Token

1. Buka [discord.com/developers/applications](https://discord.com/developers/applications)
2. Klik **New Application** → beri nama → klik **Create**
3. Masuk ke tab **Bot** → klik **Reset Token** → salin tokennya
4. Di tab **Bot**, aktifkan:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent**
   - ✅ **Presence Intent**
5. Masuk ke tab **OAuth2 → URL Generator**:
   - Scope: `bot`
   - Permissions: `Send Messages`, `Read Message History`, `Add Reactions`, `Attach Files`
6. Gunakan URL yang dihasilkan untuk invite bot ke server Discord kamu

---

## 🧠 Konfigurasi AI Provider

SoraBot mendukung beberapa provider AI. Masukkan konfigurasi di halaman **AI Providers** pada dashboard.

| Provider | Model Default | Cara Mendapatkan Key |
|----------|--------------|----------------------|
| **Google Gemini** | `gemini-2.5-flash` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| **OpenAI** | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com/api-keys) |
| **OpenRouter** | `openai/gpt-4o-mini` | [openrouter.ai](https://openrouter.ai/keys) |
| **Custom (OpenAI-compatible)** | Bebas | Sesuaikan dengan provider kamu |

Kamu bisa menambahkan beberapa provider sekaligus — bot akan otomatis fallback ke provider berikutnya jika ada yang gagal.

---

## 📁 Struktur Proyek

```
sorabot/
├── artifacts/
│   ├── api-server/          # Express API + Discord bot logic
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── discord-bot.ts   # Discord client & event handling
│   │   │   │   ├── ai-responder.ts  # AI response logic
│   │   │   │   ├── db.ts            # Database connection
│   │   │   │   └── ws.ts            # WebSocket server
│   │   │   └── routes/              # API endpoints
│   │   └── data/                    # SQLite database (dibuat otomatis)
│   └── discord-bot/         # React dashboard frontend
│       └── src/
│           ├── pages/               # Halaman dashboard
│           └── components/          # Komponen UI
├── lib/
│   ├── api-spec/            # OpenAPI spec (sumber kebenaran API)
│   ├── api-client-react/    # React Query hooks (auto-generated)
│   └── api-zod/             # Zod schemas (auto-generated)
└── pnpm-workspace.yaml
```

---

## ⚙️ Konfigurasi Lanjutan

### Ganti ke PostgreSQL

Secara default SoraBot menggunakan SQLite. Untuk beralih ke PostgreSQL:

Edit `artifacts/api-server/data/db-config.json`:

```json
{
  "provider": "postgres",
  "postgresUrl": "postgresql://user:password@host:5432/sorabot"
}
```

### Environment Variables

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `8080` | Port API server |
| `SESSION_SECRET` | — | Secret untuk session (wajib di production) |
| `NODE_ENV` | `development` | Mode environment |

---

## 🖥️ Stack Teknologi

| Lapisan | Teknologi |
|---------|-----------|
| Runtime | Node.js 24, TypeScript 5.9 |
| API Server | Express 5 |
| Database | SQLite (better-sqlite3) / PostgreSQL |
| ORM | Drizzle ORM |
| Frontend | React 19, Vite, Tailwind CSS |
| Discord | discord.js v14 |
| AI | OpenAI SDK, Google Generative AI |
| Realtime | WebSocket |
| Package Manager | pnpm workspaces |

---

## 📜 Scripts

```bash
# Jalankan API server (development)
pnpm --filter @workspace/api-server run dev

# Jalankan dashboard (development)
pnpm --filter @workspace/discord-bot run dev

# Typecheck semua packages
pnpm run typecheck

# Build semua packages
pnpm run build

# Regenerate API hooks dari OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

---

## 🤝 Kontribusi

Pull request sangat disambut! Untuk perubahan besar, buka issue terlebih dahulu untuk mendiskusikan apa yang ingin diubah.

---

<div align="center">

Dibuat dengan 💜 oleh [jackmaker9807](https://github.com/jackmaker9807)

</div>
