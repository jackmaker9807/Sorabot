# SoraBot — Panduan Deploy ke Server

Panduan ini mencakup instalasi di:
- **VPS** (Ubuntu 22.04 / 24.04 / Debian 12)
- **Orange Pi Zero 3** (Armbian, ARM64)
- Server Linux lainnya (x86_64 / aarch64)

> **Tidak memerlukan Docker.**

---

## Kebutuhan Sistem

| Komponen | Minimum |
|----------|---------|
| OS | Ubuntu 22.04 / Debian 12 / Armbian |
| RAM | 512 MB (1 GB disarankan untuk Orange Pi) |
| Storage | 2 GB kosong |
| Arsitektur | x86_64 atau aarch64 (ARM64) |

---

## Cara Install (Otomatis)

### 1. Siapkan file project di server

**Opsi A — Copy dari lokal via scp:**
```bash
# Dari komputer lokal kamu
scp -r /path/ke/sorabot user@IP_SERVER:/tmp/sorabot
ssh user@IP_SERVER "sudo mv /tmp/sorabot /opt/sorabot-src"
```

**Opsi B — Clone dari Git:**
```bash
git clone https://github.com/kamu/sorabot /tmp/sorabot-src
```

### 2. Jalankan installer

```bash
cd /tmp/sorabot-src
sudo bash deploy/install.sh
```

Script ini akan otomatis:
- Install Node.js 22 LTS
- Install pnpm
- Install build tools (`build-essential`, `python3`) untuk kompilasi native modules
- Build API server dan frontend
- Buat user `sorabot` untuk menjalankan service
- Setup systemd service (auto-start saat boot)
- Konfigurasi nginx sebagai reverse proxy

### 3. Edit konfigurasi

```bash
sudo nano /opt/sorabot/.env
```

Pastikan `SESSION_SECRET` sudah diisi dengan string acak yang panjang.

### 4. Jalankan

```bash
sudo systemctl start sorabot
sudo systemctl status sorabot
```

### 5. Akses dashboard

Buka browser ke: `http://IP_SERVER`

Setup wizard akan muncul pertama kali untuk membuat akun admin dan memasukkan Discord token.

---

## Cara Install Manual (Step by Step)

Kalau ingin lebih kontrol penuh:

### Step 1 — Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs build-essential python3
```

### Step 2 — Install pnpm

```bash
sudo npm install -g pnpm
```

### Step 3 — Copy project

```bash
sudo rsync -a --exclude='node_modules' --exclude='.git' \
  /path/ke/sorabot/ /opt/sorabot/
```

### Step 4 — Install dependencies

```bash
cd /opt/sorabot
# Batasi memory (penting untuk Orange Pi Zero 3 dengan RAM 1GB)
NODE_OPTIONS="--max-old-space-size=768" pnpm install --frozen-lockfile
```

### Step 5 — Build

```bash
# Build API server
cd /opt/sorabot/artifacts/api-server
NODE_OPTIONS="--max-old-space-size=768" node build.mjs

# Build frontend (BASE_PATH=/ karena serve dari root)
cd /opt/sorabot
PORT=8080 BASE_PATH=/ NODE_OPTIONS="--max-old-space-size=768" \
  pnpm --filter @workspace/discord-bot run build

# Copy frontend ke lokasi yang dibaca API server
mkdir -p /opt/sorabot/artifacts/api-server/public
cp -r /opt/sorabot/artifacts/discord-bot/dist/public/. \
      /opt/sorabot/artifacts/api-server/public/
```

### Step 6 — Setup .env

```bash
cp /opt/sorabot/deploy/.env.example /opt/sorabot/.env
# Edit dan ganti SESSION_SECRET:
nano /opt/sorabot/.env
```

### Step 7 — Jalankan

```bash
cd /opt/sorabot/artifacts/api-server
PORT=8080 NODE_ENV=production \
  FRONTEND_DIST=/opt/sorabot/artifacts/api-server/public \
  node --enable-source-maps dist/index.mjs
```

---

## Setup Systemd (Auto-start saat Boot)

```bash
# Salin service file
sudo cp /opt/sorabot/deploy/sorabot.service /etc/systemd/system/

# Buat user sorabot
sudo useradd --system --shell /bin/bash --create-home sorabot
sudo chown -R sorabot:sorabot /opt/sorabot

# Aktifkan dan jalankan
sudo systemctl daemon-reload
sudo systemctl enable sorabot
sudo systemctl start sorabot

# Cek status
sudo systemctl status sorabot

# Lihat log
sudo journalctl -u sorabot -f
```

---

## Setup Nginx (Opsional tapi Disarankan)

Nginx berguna untuk port 80, HTTPS, dan multiple domain.

```bash
sudo apt install nginx -y
sudo cp /opt/sorabot/deploy/nginx-sorabot.conf /etc/nginx/sites-available/sorabot
sudo ln -s /etc/nginx/sites-available/sorabot /etc/nginx/sites-enabled/sorabot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Tambah HTTPS dengan Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d sorabot.example.com
```

---

## Update SoraBot

Setelah ada perubahan kode di lokal:

```bash
# Copy file baru ke server
scp -r /path/ke/sorabot user@IP_SERVER:/tmp/sorabot-new

# Jalankan update script di server
ssh user@IP_SERVER "sudo SORABOT_DIR=/opt/sorabot bash /tmp/sorabot-new/deploy/update.sh"
```

Atau kalau pakai Git:
```bash
cd /opt/sorabot
sudo -u sorabot git pull
sudo bash /opt/sorabot/deploy/update.sh
```

---

## Tips Khusus Device RAM Kecil (1 GB)

`install.sh` sudah otomatis mendeteksi RAM dan mengoptimalkan semua setting. Ini yang terjadi di balik layar:

| RAM Terdeteksi | Node.js Heap | Swap Otomatis |
|---|---|---|
| ≤ 768 MB | 256 MB | ✅ Dibuat 1GB |
| ≤ 1.2 GB (1GB device) | 512 MB | ✅ Dibuat 1GB |
| ≤ 2 GB | 1024 MB | ❌ Tidak perlu |
| > 2 GB | 2048 MB | ❌ Tidak perlu |

**Untuk Orange Pi Zero 3 (1GB):**
- Script otomatis buat swap 1GB permanen di `/swapfile`
- `vm.swappiness=10` diset agar RAM dipakai lebih dulu sebelum swap
- Node.js heap dibatasi 512MB agar OS tetap punya ruang
- Build mungkin butuh **5–15 menit** — ini normal untuk ARM

**`better-sqlite3`** dikompilasi otomatis saat `pnpm install` — tidak perlu langkah tambahan karena `build-essential` dan `python3` sudah diinstall oleh script.

**CPU throttling**: Pastikan heatsink/cooling memadai saat proses build agar tidak thermal throttle.

---

## Troubleshooting

**Service tidak start:**
```bash
sudo journalctl -u sorabot -n 100 --no-pager
```

**Port 8080 sudah dipakai:**
```bash
sudo lsof -i :8080
# Ubah PORT di /opt/sorabot/.env
```

**Error `better-sqlite3` / native module:**
```bash
sudo apt install build-essential python3 -y
cd /opt/sorabot
sudo -u sorabot pnpm install --frozen-lockfile
```

**Database korup:**
```bash
# Backup dulu
cp /opt/sorabot/artifacts/api-server/data/sora.db \
   /opt/sorabot/artifacts/api-server/data/sora.db.bak
# Hapus untuk reset (akan dibuat ulang)
rm /opt/sorabot/artifacts/api-server/data/sora.db
sudo systemctl restart sorabot
```
