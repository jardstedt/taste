#!/bin/bash
set -euo pipefail

# ============================================================
# Taste VPS Setup — One-command production deployment
# ============================================================
# Prerequisites:
#   1. Fresh Ubuntu 22.04/24.04 VPS with root or sudo access
#   2. Domain with DNS A record pointing to this VPS IP
#   3. If using Cloudflare: SSL mode set to "Full (strict)"
#
# Usage:
#   curl -sL https://raw.githubusercontent.com/YOURREPO/main/scripts/vps-setup.sh | bash
#   — or —
#   git clone your-repo /opt/taste && bash /opt/taste/scripts/vps-setup.sh
# ============================================================

INSTALL_DIR="/opt/taste"
DATA_DIR="/opt/taste/data"
BACKUP_DIR="/opt/taste-backups"
REPO_URL=""  # Set below interactively

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---- Pre-flight checks ----
if [ "$(id -u)" -ne 0 ]; then
    error "Run this script as root or with sudo"
fi

echo ""
echo "============================================"
echo "  Taste VPS Setup"
echo "============================================"
echo ""

# ---- Collect user inputs ----
read -rp "Your domain (e.g. taste.yourdomain.com): " DOMAIN
[ -z "$DOMAIN" ] && error "Domain is required"

read -rp "Git repo URL (HTTPS, e.g. https://github.com/you/taste.git): " REPO_URL
[ -z "$REPO_URL" ] && error "Repo URL is required"

read -rp "Admin email (for login + Let's Encrypt): " ADMIN_EMAIL
[ -z "$ADMIN_EMAIL" ] && error "Admin email is required"

read -rsp "Admin password (min 8 chars): " ADMIN_PASSWORD
echo ""
[ ${#ADMIN_PASSWORD} -lt 8 ] && error "Password must be at least 8 characters"

echo ""
info "Domain:     $DOMAIN"
info "Repo:       $REPO_URL"
info "Admin:      $ADMIN_EMAIL"
echo ""
read -rp "Continue? (y/N) " CONFIRM
[[ "$CONFIRM" != [yY] ]] && { echo "Aborted."; exit 0; }

# ============================================================
# 1. System packages
# ============================================================
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

info "Installing prerequisites..."
apt-get install -y -qq curl git build-essential nginx certbot python3-certbot-nginx ufw sqlite3

# ============================================================
# 2. Node.js 20 LTS
# ============================================================
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
info "Node.js $(node -v)"

# ============================================================
# 3. PM2
# ============================================================
if ! command -v pm2 &>/dev/null; then
    info "Installing PM2..."
    npm install -g pm2
fi
info "PM2 $(pm2 -v)"

# ============================================================
# 4. Firewall (UFW)
# ============================================================
info "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (redirect + certbot)
ufw allow 443/tcp  # HTTPS

# Check for other services that need ports open
warn "UFW is about to be enabled. Only ports 22, 80, 443 are allowed."
warn "Check 'ss -tlnp' in another terminal if other services need ports open."
read -rp "Additional ports to allow (comma-separated, e.g. 9002,8080) or Enter to skip: " EXTRA_PORTS
if [ -n "$EXTRA_PORTS" ]; then
    IFS=',' read -ra PORTS <<< "$EXTRA_PORTS"
    for PORT in "${PORTS[@]}"; do
        PORT=$(echo "$PORT" | tr -d ' ')
        ufw allow "$PORT/tcp"
        info "Allowed port $PORT/tcp"
    done
fi

echo "y" | ufw enable
info "Firewall enabled"

# ============================================================
# 5. Clone repo & install
# ============================================================
if [ -d "$INSTALL_DIR/.git" ]; then
    info "Repo already cloned, pulling latest..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    info "Cloning repo..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Full install (devDeps needed for tsc/vite build step)
info "Installing dependencies..."
npm install

# ============================================================
# 6. Generate secrets & create .env.production
# ============================================================
info "Generating production secrets..."
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Generate VAPID keys
VAPID_OUTPUT=$(npx web-push generate-vapid-keys --json 2>/dev/null)
VAPID_PUBLIC=$(echo "$VAPID_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.publicKey)")
VAPID_PRIVATE=$(echo "$VAPID_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.privateKey)")

ENV_FILE="$INSTALL_DIR/.env.production"
cat > "$ENV_FILE" <<ENVEOF
# Taste production environment — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
NODE_ENV=production
PORT=3001

# Auth
JWT_SECRET=$JWT_SECRET
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Database
DB_PATH=$DATA_DIR/taste.db

# Security
EMAIL_ENCRYPTION_KEY=$ENCRYPTION_KEY
CORS_ORIGIN=https://$DOMAIN

# Push Notifications (VAPID)
VAPID_PUBLIC_KEY=$VAPID_PUBLIC
VAPID_PRIVATE_KEY=$VAPID_PRIVATE
VAPID_EMAIL=mailto:$ADMIN_EMAIL
ENVEOF

chmod 600 "$ENV_FILE"
info "Created .env.production (chmod 600)"

# ============================================================
# 7. Create data directory & build
# ============================================================
mkdir -p "$DATA_DIR"
mkdir -p "$INSTALL_DIR/logs"

info "Building server and dashboard..."
npm run build

# ============================================================
# 8. Nginx — temporary HTTP config for Certbot
# ============================================================
info "Configuring Nginx (HTTP-only for cert issuance)..."
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/taste <<NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/taste /etc/nginx/sites-enabled/taste
nginx -t || error "Nginx config test failed"
systemctl restart nginx
info "Nginx running (HTTP)"

# ============================================================
# 9. Let's Encrypt SSL
# ============================================================
info "Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL"
info "SSL certificate obtained"

# ============================================================
# 9b. Install full HTTPS Nginx config
# ============================================================
info "Installing production Nginx config..."
cp "$INSTALL_DIR/scripts/nginx-taste.conf" /etc/nginx/sites-available/taste
sed -i "s/YOURDOMAIN/$DOMAIN/g" /etc/nginx/sites-available/taste

nginx -t || error "Nginx production config test failed"
systemctl reload nginx
info "Nginx configured with HTTPS, auto-renewal enabled"

# ============================================================
# 10. Start with PM2
# ============================================================
info "Starting Taste with PM2..."
cd "$INSTALL_DIR"
pm2 start ecosystem.config.cjs
pm2 save

# Auto-start PM2 on boot
pm2 startup systemd -u root --hp /root
pm2 save
info "PM2 startup configured"

# ============================================================
# 11. SQLite backup cron (daily at 3 AM)
# ============================================================
info "Setting up daily database backup..."
mkdir -p "$BACKUP_DIR"

CRON_CMD="0 3 * * * sqlite3 $DATA_DIR/taste.db \".backup $BACKUP_DIR/taste-\$(date +\%Y\%m\%d).db\" && find $BACKUP_DIR -name 'taste-*.db' -mtime +30 -delete"
(crontab -l 2>/dev/null | grep -v "taste.*backup" || true; echo "$CRON_CMD") | crontab -
info "Daily backup at 3 AM, 30-day retention"

# ============================================================
# Done
# ============================================================
echo ""
echo "============================================"
echo -e "${GREEN}  Taste is live!${NC}"
echo "============================================"
echo ""
echo "  URL:           https://$DOMAIN"
echo "  Admin login:   $ADMIN_EMAIL"
echo "  PM2 status:    pm2 status"
echo "  PM2 logs:      pm2 logs taste"
echo "  Redeploy:      cd $INSTALL_DIR && bash scripts/deploy.sh"
echo ""
echo "  VAPID public key (for client config):"
echo "  $VAPID_PUBLIC"
echo ""
echo "  Files:"
echo "  App:           $INSTALL_DIR"
echo "  Env:           $ENV_FILE"
echo "  DB:            $DATA_DIR/taste.db"
echo "  Backups:       $BACKUP_DIR/"
echo "  Nginx:         /etc/nginx/sites-available/taste"
echo "  Logs:          $INSTALL_DIR/logs/"
echo ""
echo "  Next steps:"
echo "  1. Verify: curl -I https://$DOMAIN"
echo "  2. Test login at https://$DOMAIN"
echo "  3. Test push notifications"
echo "  4. SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
