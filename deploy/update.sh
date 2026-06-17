#!/usr/bin/env bash
# SoraBot — Update Script
# Jalankan dari root folder project: sudo bash deploy/update.sh

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

INSTALL_DIR="${SORABOT_DIR:-/opt/sorabot}"
SERVICE_USER="sorabot"

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan sebagai root: sudo bash deploy/update.sh"; exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info "=== Update SoraBot ==="

# ── Stop service ─────────────────────────────────────────────────────────────
info "Menghentikan service..."
systemctl stop sorabot || true

# ── Sync files ───────────────────────────────────────────────────────────────
info "Menyinkronkan file project..."
rsync -a --exclude='node_modules' --exclude='.git' --exclude='deploy' \
  --exclude='artifacts/api-server/data' \
  --exclude='artifacts/api-server/dist' \
  --exclude='artifacts/discord-bot/dist' \
  --exclude='lib/*/dist' \
  --exclude='.env' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ── Install / update dependencies ────────────────────────────────────────────
info "Update dependencies..."
export NODE_OPTIONS="--max-old-space-size=768"
su -s /bin/bash "$SERVICE_USER" -c "
  cd $INSTALL_DIR
  pnpm install --frozen-lockfile
"

# ── Rebuild ───────────────────────────────────────────────────────────────────
info "Build API server..."
su -s /bin/bash "$SERVICE_USER" -c "
  cd $INSTALL_DIR/artifacts/api-server
  NODE_OPTIONS='--max-old-space-size=768' node build.mjs
"

info "Build frontend dashboard..."
su -s /bin/bash "$SERVICE_USER" -c "
  cd $INSTALL_DIR
  PORT=8080 BASE_PATH=/ NODE_OPTIONS='--max-old-space-size=768' \
    pnpm --filter @workspace/discord-bot run build
"

info "Salin frontend ke public dir..."
FRONTEND_DIST="$INSTALL_DIR/artifacts/api-server/public"
rm -rf "$FRONTEND_DIST"
mkdir -p "$FRONTEND_DIST"
cp -r "$INSTALL_DIR/artifacts/discord-bot/dist/public/." "$FRONTEND_DIST/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$FRONTEND_DIST"

# ── Restart ───────────────────────────────────────────────────────────────────
info "Memulai ulang service..."
systemctl start sorabot

sleep 2
if systemctl is-active --quiet sorabot; then
  echo -e "${GREEN}✓ SoraBot berhasil diupdate dan berjalan!${NC}"
else
  echo "✗ Service gagal start. Cek log: journalctl -u sorabot -n 50"
  exit 1
fi
