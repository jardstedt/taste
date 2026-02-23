#!/bin/bash
set -euo pipefail

# Deploy Taste — pull latest, build, restart
# Usage: ssh into VPS, then: cd /opt/taste && bash scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== Taste Deploy ==="
echo "Directory: $PROJECT_DIR"
echo ""

# Pull latest
echo "[1/4] Pulling latest code..."
git pull origin main

# Install dependencies (including devDeps needed for build)
echo "[2/4] Installing dependencies..."
npm install

# Build server and dashboard
echo "[3/4] Building..."
npm run build

# Restart PM2
echo "[4/4] Restarting PM2..."
pm2 restart taste --update-env

echo ""
echo "=== Deploy complete ==="
pm2 status taste
