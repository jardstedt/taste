#!/bin/bash
set -euo pipefail

# ============================================================
# Taste VPS Setup — One-command production deployment
# ============================================================
# Prerequisites:
#   1. Fresh Ubuntu 22.04/24.04 VPS with root or sudo access
#   2. Domain with DNS A record pointing to this VPS IP
#   3. Cloudflare: proxy ON, SSL mode "Full (strict)"
#   4. Cloudflare Origin Certificate created and saved locally
#      (SSL/TLS → Origin Server → Create Certificate)
#
# Co-located services:
#   - Aethir Checker Node on port 9002 (/home/AethirCheckerCLI-linux/)
#   - Do NOT restart or interfere with Aethir processes
#
# Usage:
#   git clone your-repo /opt/taste && bash /opt/taste/scripts/vps-setup.sh
# ============================================================

INSTALL_DIR="/opt/taste"
DATA_DIR="/opt/taste/data"
BACKUP_DIR="/opt/taste-backups"
CLOUDFLARE_CERT_DIR="/etc/ssl/cloudflare"
REPO_URL=""

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
read -rp "Your domain (e.g. humantaste.app): " DOMAIN
[ -z "$DOMAIN" ] && error "Domain is required"

read -rp "Git repo URL (HTTPS, e.g. https://github.com/you/taste.git): " REPO_URL
[ -z "$REPO_URL" ] && error "Repo URL is required"

read -rp "Admin email (for login): " ADMIN_EMAIL
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
apt-get install -y -qq curl git build-essential nginx ufw sqlite3 python3

# ============================================================
# 2. Node.js 20 LTS via nvm
# ============================================================
# NodeSource doesn't work on all Ubuntu versions — nvm is more reliable
export NVM_DIR="/root/.nvm"

if [ ! -d "$NVM_DIR" ]; then
    info "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi

# Load nvm
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    info "Installing Node.js 20 LTS via nvm..."
    nvm install 20
    nvm alias default 20
fi
info "Node.js $(node -v)"

# Symlink node/npm to /usr/local/bin so PM2 systemd service can find them
ln -sf "$(which node)" /usr/local/bin/node
ln -sf "$(which npm)" /usr/local/bin/npm
ln -sf "$(which npx)" /usr/local/bin/npx

# ============================================================
# 3. PM2
# ============================================================
if ! command -v pm2 &>/dev/null; then
    info "Installing PM2..."
    npm install -g pm2
fi
ln -sf "$(which pm2)" /usr/local/bin/pm2
info "PM2 $(pm2 -v)"

# ============================================================
# 4. Firewall (UFW)
# ============================================================
info "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 9002/tcp  # Aethir Checker Node

# Check for other services that need ports open
warn "UFW will allow ports: 22, 80, 443, 9002 (Aethir)"
read -rp "Additional ports to allow (comma-separated) or Enter to skip: " EXTRA_PORTS
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

# Virtuals ACP (fill in when ready to connect)
# ACP_WALLET_PRIVATE_KEY=
# ACP_AGENT_WALLET_ADDRESS=
# ACP_SESSION_ENTITY_KEY_ID=
# GAME_API_KEY=
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
# 8. Cloudflare Origin Certificate
# ============================================================
info "Setting up Cloudflare Origin Certificate..."
mkdir -p "$CLOUDFLARE_CERT_DIR"

if [ ! -f "$CLOUDFLARE_CERT_DIR/$DOMAIN.pem" ]; then
    echo ""
    warn "Paste your Cloudflare Origin Certificate below."
    warn "Create it at: Cloudflare → SSL/TLS → Origin Server → Create Certificate"
    warn "Paste the certificate, then press Ctrl+D on a new line:"
    echo ""
    cat > "$CLOUDFLARE_CERT_DIR/$DOMAIN.pem"
    echo ""

    warn "Now paste the Private Key, then press Ctrl+D on a new line:"
    echo ""
    cat > "$CLOUDFLARE_CERT_DIR/$DOMAIN.key"
    chmod 600 "$CLOUDFLARE_CERT_DIR/$DOMAIN.key"
    echo ""
    info "Certificate and key saved"
else
    info "Certificate already exists at $CLOUDFLARE_CERT_DIR/$DOMAIN.pem"
fi

# ============================================================
# 9. Nginx — Cloudflare reverse proxy
# ============================================================
info "Configuring Nginx with Cloudflare Origin Certificate..."

# Determine nginx config directory (sites-available or conf.d)
if [ -d /etc/nginx/sites-available ]; then
    NGINX_CONF="/etc/nginx/sites-available/taste"
    NGINX_ENABLED="/etc/nginx/sites-enabled/taste"
    rm -f /etc/nginx/sites-enabled/default
else
    NGINX_CONF="/etc/nginx/conf.d/taste.conf"
    NGINX_ENABLED=""
    # Remove default conf if present
    rm -f /etc/nginx/conf.d/default.conf
fi

cat > "$NGINX_CONF" <<NGINXEOF
# Taste — Nginx reverse proxy with Cloudflare Origin Certificate
# Generated by vps-setup.sh

limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

# Redirect HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # Cloudflare Origin Certificate
    ssl_certificate $CLOUDFLARE_CERT_DIR/$DOMAIN.pem;
    ssl_certificate_key $CLOUDFLARE_CERT_DIR/$DOMAIN.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # Real client IP from Cloudflare
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    # API — rate limited
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3001;
    }

    # Socket.io — WebSocket upgrade
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Static assets — long cache
    location /assets/ {
        proxy_pass http://127.0.0.1:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        proxy_pass http://127.0.0.1:3001;
    }

    # Block dotfiles
    location ~ /\. {
        deny all;
        return 404;
    }

    client_max_body_size 2m;
}
NGINXEOF

# Enable site if using sites-available pattern
if [ -n "$NGINX_ENABLED" ]; then
    ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
fi

nginx -t || error "Nginx config test failed"
systemctl restart nginx
info "Nginx configured with Cloudflare Origin Certificate"

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
echo "  Nginx:         $NGINX_CONF"
echo "  SSL cert:      $CLOUDFLARE_CERT_DIR/$DOMAIN.pem"
echo "  Logs:          $INSTALL_DIR/logs/"
echo ""
echo "  Cloudflare settings to verify:"
echo "  - SSL/TLS → Overview: Full (strict)"
echo "  - SSL/TLS → Edge Certificates → Always Use HTTPS: On"
echo "  - Network → WebSockets: On"
echo ""
echo "  Co-located services:"
echo "  - Aethir Checker Node on port 9002 (DO NOT restart)"
echo ""
echo "  Next steps:"
echo "  1. Verify: curl -I https://$DOMAIN"
echo "  2. Test login at https://$DOMAIN"
echo "  3. Test push notifications on mobile"
echo "  4. See scripts/POST_DEPLOY_CHECKLIST.md"
echo ""
