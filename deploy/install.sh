#!/usr/bin/env bash
# SoraBot — Install Script
# Supports: Ubuntu 22.04/24.04, Debian 12, Armbian (Orange Pi Zero 3 ARM64)
# Usage: sudo bash deploy/install.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

INSTALL_DIR="${SORABOT_DIR:-/opt/sorabot}"
SERVICE_USER="sorabot"
NODE_VERSION="22"

echo
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         SoraBot Installer — v1.0                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Jalankan sebagai root: sudo bash deploy/install.sh"
fi

# ── Detect hardware ───────────────────────────────────────────────────────────
ARCH=$(uname -m)
TOTAL_RAM_MB=$(awk '/MemTotal/ { printf "%d", $2/1024 }' /proc/meminfo)
TOTAL_RAM_GB=$(awk "BEGIN { printf \"%.1f\", $TOTAL_RAM_MB/1024 }")
SWAP_MB=$(awk '/SwapTotal/ { printf "%d", $2/1024 }' /proc/meminfo)

info "Arsitektur : $ARCH"
info "RAM        : ${TOTAL_RAM_MB} MB (${TOTAL_RAM_GB} GB)"
info "Swap       : ${SWAP_MB} MB"
info "Install dir: $INSTALL_DIR"
echo

# Hitung NODE_OPTIONS berdasarkan RAM yang tersedia
# Sisakan ~256MB untuk OS, alokasikan sisanya untuk Node
if [[ $TOTAL_RAM_MB -le 768 ]]; then
  NODE_MEM=256
  NEED_SWAP=true
elif [[ $TOTAL_RAM_MB -le 1200 ]]; then
  NODE_MEM=512   # Ideal untuk 1GB RAM
  NEED_SWAP=true
elif [[ $TOTAL_RAM_MB -le 2048 ]]; then
  NODE_MEM=1024
  NEED_SWAP=false
else
  NODE_MEM=2048
  NEED_SWAP=false
fi

export NODE_OPTIONS="--max-old-space-size=${NODE_MEM}"
info "Node.js max heap: ${NODE_MEM} MB"

# ── Setup swap (otomatis untuk RAM ≤ 1.2GB) ──────────────────────────────────
step "Memeriksa Swap Memory"

if [[ "$NEED_SWAP" == "true" ]]; then
  if [[ $SWAP_MB -lt 512 ]]; then
    warn "RAM ${TOTAL_RAM_MB}MB — swap diperlukan untuk proses build."

    # Cari lokasi swap yang cocok
    SWAP_FILE="/swapfile"
    SWAP_SIZE="1G"

    if [[ -f "$SWAP_FILE" ]]; then
      info "Swapfile sudah ada di $SWAP_FILE, skip pembuatan."
      swapon "$SWAP_FILE" 2>/dev/null || true
    else
      info "Membuat swap ${SWAP_SIZE} di $SWAP_FILE ..."
      fallocate -l "$SWAP_SIZE" "$SWAP_FILE" 2>/dev/null || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=1024 status=progress
      chmod 600 "$SWAP_FILE"
      mkswap "$SWAP_FILE"
      swapon "$SWAP_FILE"

      # Tambah ke fstab agar permanen
      if ! grep -q "$SWAP_FILE" /etc/fstab; then
        echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
        info "Swap ditambahkan ke /etc/fstab (permanen)"
      fi
    fi

    # Kurangi swappiness agar RAM dipakai lebih dulu
    sysctl -w vm.swappiness=10 >/dev/null
    if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
      echo "vm.swappiness=10" >> /etc/sysctl.conf
    fi

    NEW_SWAP=$(awk '/SwapTotal/ { printf "%d", $2/1024 }' /proc/meminfo)
    info "Swap aktif: ${NEW_SWAP} MB ✓"
  else
    info "Swap sudah cukup: ${SWAP_MB} MB ✓"
  fi
else
  info "RAM cukup (${TOTAL_RAM_MB}MB), swap opsional."
fi

# ── System packages ───────────────────────────────────────────────────────────
step "Menginstall Paket Sistem"

apt-get update -qq
apt-get install -y -qq \
  curl git rsync build-essential python3 \
  ca-certificates gnupg nginx 2>/dev/null \
  || apt-get install -y -qq \
  curl git rsync build-essential python3 ca-certificates gnupg
info "Paket sistem terinstall ✓"

# ── Node.js via NodeSource ─────────────────────────────────────────────────────
step "Menginstall Node.js $NODE_VERSION"

if command -v node &>/dev/null; then
  INSTALLED_MAJOR=$(node -v | cut -d. -f1 | tr -d 'v')
  if [[ "$INSTALLED_MAJOR" -ge "$NODE_VERSION" ]]; then
    info "Node.js sudah terinstall: $(node -v) ✓"
  else
    info "Upgrade Node.js dari v$INSTALLED_MAJOR ke v$NODE_VERSION..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null
    apt-get install -y -qq nodejs
  fi
else
  info "Menginstall Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
info "Node.js: $(node -v) ✓"

# ── pnpm ──────────────────────────────────────────────────────────────────────
step "Menginstall pnpm"

if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm@latest --quiet
fi
info "pnpm: $(pnpm -v) ✓"

# ── Service user ──────────────────────────────────────────────────────────────
step "Menyiapkan User & Direktori"

if ! id "$SERVICE_USER" &>/dev/null; then
  info "Membuat user '$SERVICE_USER'..."
  useradd --system --shell /bin/bash --create-home --home-dir /home/$SERVICE_USER "$SERVICE_USER"
fi

mkdir -p "$INSTALL_DIR/artifacts/api-server/data"

# ── Sync project files ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info "Menyalin file dari $PROJECT_ROOT ke $INSTALL_DIR..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.agents' \
  --exclude='.local' \
  --exclude='.cache' \
  --exclude='deploy' \
  --exclude='attached_assets' \
  --exclude='artifacts/api-server/data/*.db' \
  --exclude='artifacts/api-server/data/*.db-shm' \
  --exclude='artifacts/api-server/data/*.db-wal' \
  --exclude='artifacts/api-server/dist' \
  --exclude='artifacts/discord-bot/dist' \
  --exclude='lib/*/dist' \
  --exclude='*.tsbuildinfo' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
info "File project disalin ✓"

# ── Install dependencies ──────────────────────────────────────────────────────
step "Menginstall Dependencies"

warn "Proses ini bisa memakan 5–15 menit di Orange Pi Zero 3. Harap tunggu..."

su -s /bin/bash "$SERVICE_USER" -c "
  export NODE_OPTIONS='--max-old-space-size=${NODE_MEM}'
  cd $INSTALL_DIR
  pnpm install --frozen-lockfile 2>&1
"
info "Dependencies terinstall ✓"

# ── Build API server ──────────────────────────────────────────────────────────
step "Build API Server"

su -s /bin/bash "$SERVICE_USER" -c "
  export NODE_OPTIONS='--max-old-space-size=${NODE_MEM}'
  cd $INSTALL_DIR/artifacts/api-server
  node build.mjs
"
info "API server berhasil di-build ✓"

# ── Build frontend ────────────────────────────────────────────────────────────
step "Build Frontend Dashboard"

su -s /bin/bash "$SERVICE_USER" -c "
  export NODE_OPTIONS='--max-old-space-size=${NODE_MEM}'
  cd $INSTALL_DIR
  PORT=8080 BASE_PATH=/ pnpm --filter @workspace/discord-bot run build
"

FRONTEND_DIST="$INSTALL_DIR/artifacts/api-server/public"
rm -rf "$FRONTEND_DIST"
mkdir -p "$FRONTEND_DIST"
cp -r "$INSTALL_DIR/artifacts/discord-bot/dist/public/." "$FRONTEND_DIST/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$FRONTEND_DIST"
info "Frontend berhasil di-build ✓"

# ── .env ──────────────────────────────────────────────────────────────────────
step "Konfigurasi Environment"

ENV_FILE="$INSTALL_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$ENV_FILE" <<EOF
# SoraBot Environment Variables — dibuat otomatis oleh installer
NODE_ENV=production
PORT=8080
SESSION_SECRET=${SESSION_SECRET}
FRONTEND_DIST=${FRONTEND_DIST}
EOF
  chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  info ".env dibuat: $ENV_FILE ✓"
else
  info ".env sudah ada, dilewati (hapus manual jika ingin reset) ✓"
fi

# ── systemd service ───────────────────────────────────────────────────────────
step "Memasang Systemd Service"

NODE_BIN=$(which node)

cat > /etc/systemd/system/sorabot.service <<EOF
[Unit]
Description=SoraBot — Discord AI Bot & Dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/artifacts/api-server
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=FRONTEND_DIST=${FRONTEND_DIST}

# Batasi memory di device RAM kecil (${TOTAL_RAM_MB}MB RAM terdeteksi)
Environment=NODE_OPTIONS=--max-old-space-size=${NODE_MEM}

ExecStart=${NODE_BIN} --enable-source-maps ${INSTALL_DIR}/artifacts/api-server/dist/index.mjs
Restart=always
RestartSec=5
StartLimitInterval=60
StartLimitBurst=5

StandardOutput=journal
StandardError=journal
SyslogIdentifier=sorabot

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sorabot
info "Systemd service terpasang & diaktifkan ✓"

# ── nginx ─────────────────────────────────────────────────────────────────────
step "Konfigurasi Nginx"

if command -v nginx &>/dev/null; then
  cp "$SCRIPT_DIR/nginx-sorabot.conf" /etc/nginx/sites-available/sorabot
  ln -sf /etc/nginx/sites-available/sorabot /etc/nginx/sites-enabled/sorabot
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    info "Nginx dikonfigurasi ✓"
  else
    warn "Nginx config bermasalah — cek: nginx -t"
  fi
fi

# ── Selesai ───────────────────────────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')
echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         SoraBot berhasil diinstall! ✓                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo
echo -e "  RAM terdeteksi  : ${TOTAL_RAM_MB} MB"
echo -e "  Node.js heap    : ${NODE_MEM} MB"
[[ "$NEED_SWAP" == "true" ]] && echo -e "  Swap            : Aktif (1 GB)"
echo
info "Jalankan bot:"
echo "  sudo systemctl start sorabot"
echo "  sudo systemctl status sorabot"
echo "  sudo journalctl -u sorabot -f"
echo
info "Akses dashboard:"
echo "  http://${IP}:8080   (langsung)"
echo "  http://${IP}        (via nginx)"
echo
warn "Setup wizard akan muncul otomatis pertama kali di browser."
warn "Edit ${ENV_FILE} untuk konfigurasi tambahan."
