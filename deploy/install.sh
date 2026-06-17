#!/usr/bin/env bash
# SoraBot — Install Script
# Supports: Ubuntu 22.04/24.04, Debian 12, Armbian (Orange Pi Zero 3 ARM64)
# Usage: bash install.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

INSTALL_DIR="${SORABOT_DIR:-/opt/sorabot}"
SERVICE_USER="sorabot"
NODE_VERSION="22"

info "=== SoraBot Installer ==="
info "Install dir : $INSTALL_DIR"
info "Node.js     : v$NODE_VERSION (LTS)"
echo

# ── Root check ───────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Jalankan script ini sebagai root: sudo bash install.sh"
fi

# ── Detect arch ──────────────────────────────────────────────────────────────
ARCH=$(uname -m)
info "Arsitektur: $ARCH"
case "$ARCH" in
  x86_64|aarch64|armv7l) ;;
  *) warn "Arsitektur '$ARCH' belum diuji, lanjut..." ;;
esac

# ── System packages ──────────────────────────────────────────────────────────
info "Menginstall dependensi sistem..."
apt-get update -qq
apt-get install -y -qq \
  curl git build-essential python3 ca-certificates gnupg \
  nginx 2>/dev/null || apt-get install -y -qq \
  curl git build-essential python3 ca-certificates gnupg

# ── Node.js via NodeSource ────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  info "Menginstall Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
else
  info "Node.js sudah terinstall: $(node -v)"
fi

# ── pnpm ─────────────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  info "Menginstall pnpm..."
  npm install -g pnpm@latest
else
  info "pnpm sudah terinstall: $(pnpm -v)"
fi

# ── Service user ─────────────────────────────────────────────────────────────
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Membuat user '$SERVICE_USER'..."
  useradd --system --shell /bin/bash --create-home --home-dir /home/$SERVICE_USER "$SERVICE_USER"
fi

# ── Install dir ──────────────────────────────────────────────────────────────
info "Menyiapkan direktori $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/artifacts/api-server/data"

# Copy project files (jalankan dari root folder project)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info "Menyalin file project dari $PROJECT_ROOT..."
rsync -a --exclude='node_modules' --exclude='.git' --exclude='deploy' \
  --exclude='artifacts/api-server/data/*.db' \
  --exclude='artifacts/api-server/dist' \
  --exclude='artifacts/discord-bot/dist' \
  --exclude='lib/*/dist' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ── Install dependencies & build ─────────────────────────────────────────────
info "Menginstall dependencies (ini mungkin butuh beberapa menit)..."
# Batasi memory untuk board dengan RAM terbatas (seperti Orange Pi Zero 3)
export NODE_OPTIONS="--max-old-space-size=768"

su -s /bin/bash "$SERVICE_USER" -c "
  cd $INSTALL_DIR
  pnpm install --frozen-lockfile
"

info "Membangun lib packages..."
su -s /bin/bash "$SERVICE_USER" -c "
  cd $INSTALL_DIR
  NODE_OPTIONS='--max-old-space-size=768' pnpm run typecheck:libs 2>/dev/null || true
"

info "Membangun API server..."
su -s /bin/bash "$SERVICE_USER" -c "
  cd $INSTALL_DIR/artifacts/api-server
  NODE_OPTIONS='--max-old-space-size=768' node build.mjs
"

info "Membangun frontend dashboard..."
su -s /bin/bash "$SERVICE_USER" -c "
  cd $INSTALL_DIR
  PORT=8080 BASE_PATH=/ NODE_OPTIONS='--max-old-space-size=768' \
    pnpm --filter @workspace/discord-bot run build
"

# Salin frontend dist ke lokasi yang dibaca oleh API server
FRONTEND_DIST="$INSTALL_DIR/artifacts/api-server/public"
mkdir -p "$FRONTEND_DIST"
cp -r "$INSTALL_DIR/artifacts/discord-bot/dist/public/." "$FRONTEND_DIST/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$FRONTEND_DIST"

# ── .env file ────────────────────────────────────────────────────────────────
ENV_FILE="$INSTALL_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  info "Membuat .env..."
  SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$ENV_FILE" <<EOF
# SoraBot Environment Variables
NODE_ENV=production
PORT=8080
SESSION_SECRET=$SESSION_SECRET
# FRONTEND_DIST=/opt/sorabot/artifacts/api-server/public
EOF
  chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  info ".env dibuat di $ENV_FILE"
fi

# ── systemd service ───────────────────────────────────────────────────────────
info "Memasang systemd service..."
SCRIPT_DIR_ABS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN=$(which node)

cat > /etc/systemd/system/sorabot.service <<EOF
[Unit]
Description=SoraBot — Discord AI Bot & Dashboard
Documentation=https://github.com/sorabot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/artifacts/api-server
EnvironmentFile=$ENV_FILE
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=FRONTEND_DIST=$INSTALL_DIR/artifacts/api-server/public
ExecStart=$NODE_BIN --enable-source-maps $INSTALL_DIR/artifacts/api-server/dist/index.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sorabot

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sorabot

# ── nginx ─────────────────────────────────────────────────────────────────────
if command -v nginx &>/dev/null; then
  info "Memasang konfigurasi nginx..."
  cp "$SCRIPT_DIR_ABS/nginx-sorabot.conf" /etc/nginx/sites-available/sorabot
  ln -sf /etc/nginx/sites-available/sorabot /etc/nginx/sites-enabled/sorabot
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t && systemctl reload nginx || warn "nginx config error — cek manual"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           SoraBot berhasil diinstall! ✓              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo
info "Untuk memulai bot:"
echo "  sudo systemctl start sorabot"
echo "  sudo systemctl status sorabot"
echo "  sudo journalctl -u sorabot -f"
echo
info "Dashboard tersedia di: http://$(hostname -I | awk '{print $1}'):8080"
info "Atau via nginx     di: http://$(hostname -I | awk '{print $1}')"
echo
warn "Edit $ENV_FILE untuk mengatur SESSION_SECRET dan variabel lainnya."
