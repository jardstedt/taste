# VPS Setup — humantaste.app

## Server Info

- **IP:** 107.173.236.164
- **Domain:** humantaste.app
- **DNS/CDN:** Cloudflare (proxy ON, Full Strict SSL)
- **OS:** Ubuntu (RackNerd VPS, hostname: racknerd-19f4019)
- **RAM:** 2.9GB (Aethir uses ~24MB, ~2.6GB available)
- **Disk:** 43GB (34GB free)

## Co-located Services

### Aethir Checker Nodes
- Binary: `AethirCheckerCLI` (installed via `install.sh`)
- Runs as a standalone process — no Docker, no nginx
- Cannot run multiple instances on same machine
- Ports: (check with `ss -tlnp` and record here)
- **Do not restart or kill this process during deployments**

## Taste Deployment

### System Dependencies
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs build-essential python3

# Nginx (reverse proxy)
apt install -y nginx

# PM2 (process manager)
npm install -g pm2
```

### Directory Structure
```
/opt/taste/                  # Application root
  ├── .env.production        # Production environment (secrets — not in git)
  ├── data/taste.db          # SQLite database
  ├── logs/                  # PM2 log files
  ├── server/dist/           # Compiled server
  └── dashboard/dist/        # Built frontend
```

### Clone and Build
```bash
mkdir -p /opt/taste && cd /opt/taste
git clone <repo-url> .
npm install
mkdir -p data logs
npm run build
```

### Environment File
```bash
nano /opt/taste/.env.production
```

Required variables:
```env
PORT=3001
NODE_ENV=production
JWT_SECRET=               # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ADMIN_EMAIL=              # Initial admin expert email
ADMIN_PASSWORD=           # Min 8 chars (hashed on first run, can remove after)
DB_PATH=./data/taste.db
EMAIL_ENCRYPTION_KEY=     # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CORS_ORIGIN=https://humantaste.app

# Push Notifications — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:admin@humantaste.app

# ACP (add when ready)
ACP_WALLET_PRIVATE_KEY=
ACP_AGENT_WALLET_ADDRESS=
ACP_SESSION_ENTITY_KEY_ID=
GAME_API_KEY=
```

### SSL — Cloudflare Origin Certificate
Cloudflare handles public-facing SSL. Origin cert encrypts Cloudflare ↔ VPS traffic.

```bash
mkdir -p /etc/ssl/cloudflare
nano /etc/ssl/cloudflare/humantaste.app.pem    # Origin Certificate
nano /etc/ssl/cloudflare/humantaste.app.key    # Private Key
chmod 600 /etc/ssl/cloudflare/humantaste.app.key
```

Cloudflare dashboard settings:
- SSL/TLS → Overview: **Full (strict)**
- SSL/TLS → Edge Certificates → Always Use HTTPS: **On**
- Network → WebSockets: **On**

### Nginx Config
```bash
nano /etc/nginx/sites-available/taste
# (or /etc/nginx/conf.d/taste.conf if sites-available doesn't exist)
```

See `scripts/nginx-taste.conf` for the config template.
After editing, replace YOURDOMAIN and cert paths to match Cloudflare setup:
- `ssl_certificate /etc/ssl/cloudflare/humantaste.app.pem`
- `ssl_certificate_key /etc/ssl/cloudflare/humantaste.app.key`

```bash
ln -sf /etc/nginx/sites-available/taste /etc/nginx/sites-enabled/taste
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### Start with PM2
```bash
cd /opt/taste
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # run the command it outputs to enable boot persistence
```

### Verify
```bash
curl https://humantaste.app/api/health
pm2 logs taste --lines 20
```

## Routine Deploys
```bash
ssh root@107.173.236.164
cd /opt/taste && bash scripts/deploy.sh
```
This runs: git pull → npm install → npm run build → pm2 restart taste

## Monitoring
```bash
pm2 status                    # Process health
pm2 logs taste --lines 50     # Application logs
pm2 monit                     # Real-time CPU/memory
ss -tlnp                      # Listening ports
df -h && free -h              # Disk and memory
```

## Ports in Use
- **:80** — Nginx (HTTP → HTTPS redirect)
- **:443** — Nginx (HTTPS, proxies to :3001)
- **:3001** — Taste Express server (localhost only, not exposed)
- **:9002** — Aethir Checker Node (AethirCheckerService, running from /home/AethirCheckerCLI-linux/)

## Safety Rules
- **Never kill Aethir processes** — they earn rewards and can't be multi-instanced
- **Never run `npm install` as root** without `--unsafe-perm` if needed for native modules
- **Always `nginx -t` before `systemctl reload nginx`** — syntax check prevents downtime
- **Back up the database** before major updates: `cp data/taste.db data/taste.db.bak`
