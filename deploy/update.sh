#!/usr/bin/env bash
# SoraBot — Update Script
# Jalankan dari root folder project: sudo bash deploy/update.sh

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
step() { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

INSTALL_DIR="${SORABOT_DIR:-/opt/sorabot}"
SERVICE_USER="sorabot"

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan sebagai root: sudo bash deploy/update.sh"; exit 1
fi

# ── Deteksi RAM & set NODE_OPTIONS ───────────────────────────────────────────
TOTAL_RAM_MB=$(awk '/MemTotal/ { printf "%d", $2/1024 }' /proc/meminfo)
if   [[ $TOTAL_RAM_MB -le 768  ]]; then NODE_MEM=256
elif [[ $TOTAL_RAM_MB -le 1200 ]]; then NODE_MEM=512
elif [[ $TOTAL_RAM_MB -le 2048 ]]; then NODE_MEM=1024
else NODE_MEM=2048
fi
export NODE_OPTIONS="--max-old-space-size=${NODE_MEM}"
info "RAM: ${TOTAL_RAM_MB}MB — Node.js heap: ${NODE_MEM}MB"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo
info "=== Update SoraBot ==="

step "Menghentikan Service"
systemctl stop sorabot || true

step "Menyinkronkan File Project"
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.agents' \
  --exclude='.local' \
  --exclude='.cache' \
  --exclude='deploy' \
  --exclude='attached_assets' \
  --exclude='artifacts/api-server/data' \
  --exclude='artifacts/api-server/dist' \
  --exclude='artifacts/discord-bot/dist' \
  --exclude='lib/*/dist' \
  --exclude='*.tsbuildinfo' \
  --exclude='.env' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
info "File disinkronkan ✓"

step "Update Dependencies"
warn "Mungkin butuh beberapa menit di device RAM kecil..."
su -s /bin/bash "$SERVICE_USER" -c "
  export NODE_OPTIONS='--max-old-space-size=${NODE_MEM}'
  cd $INSTALL_DIR
  pnpm install --frozen-lockfile
"

step "Build API Server"
su -s /bin/bash "$SERVICE_USER" -c "
  export NODE_OPTIONS='--max-old-space-size=${NODE_MEM}'
  cd $INSTALL_DIR/artifacts/api-server
  node build.mjs
"

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

# Update NODE_OPTIONS di systemd service agar sesuai RAM saat ini
step "Update Systemd Service"
sed -i "s/--max-old-space-size=[0-9]*/--max-old-space-size=${NODE_MEM}/g" \
  /etc/systemd/system/sorabot.service 2>/dev/null || true
systemctl daemon-reload

step "Memulai Ulang Service"
systemctl start sorabot

sleep 3
if systemctl is-active --quiet sorabot; then
  echo
  echo -e "${GREEN}✓ SoraBot berhasil diupdate dan berjalan!${NC}"
  echo "  Log: journalctl -u sorabot -f"
else
  echo "✗ Service gagal start. Cek: journalctl -u sorabot -n 50"
  exit 1
fi
