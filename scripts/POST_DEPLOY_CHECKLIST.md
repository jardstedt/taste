# Post-Deploy Security Checklist

## Immediately after first deploy
- [ ] Login to dashboard at https://taste-api.com
- [ ] Change admin password through the dashboard
- [ ] Remove `ADMIN_PASSWORD` from `.env.production` on VPS (seed already ran, no longer needed)
- [ ] Verify cookie has `Secure` flag (browser devtools > Application > Cookies)

## DNS / SSL (Cloudflare)
- [ ] Cloudflare SSL mode set to "Full (strict)"
- [ ] Cloudflare Origin Certificate installed on VPS at `/etc/ssl/cloudflare/`
- [ ] Always Use HTTPS enabled (SSL/TLS → Edge Certificates)
- [ ] WebSockets enabled (Network → WebSockets)
- [ ] Verify HTTPS: `curl -I https://taste-api.com`

## Firewall / Access
- [ ] UFW enabled with ports 22, 80, 443, 9002 (Aethir)
- [ ] Verify with `sudo ufw status`
- [ ] SSH key auth only (disable password auth in `/etc/ssh/sshd_config` if not already)

## Co-located services
- [ ] Aethir Checker Node still running: `ps aux | grep -i aethir`
- [ ] Port 9002 still open: `ss -tlnp | grep 9002`

## App verification
- [ ] Dashboard loads at https://taste-api.com
- [ ] Login works
- [ ] WebSocket connects (devtools > Network > WS)
- [ ] Push notification prompt appears and works
- [ ] Security headers present: `curl -I https://taste-api.com`
- [ ] Add to Home Screen works on mobile (PWA)

## Ongoing
- [ ] PM2 survives reboot: `sudo reboot`, then check `pm2 status`
- [ ] SQLite backups running: check `/opt/taste-backups/` after 3 AM
- [ ] Set up SSH key auth if using password auth
- [ ] Keep Ubuntu updated: `sudo apt update && sudo apt upgrade`
