# Post-Deploy Security Checklist

## Immediately after first deploy
- [ ] Login to dashboard at https://taste.tech
- [ ] Change admin password through the dashboard
- [ ] Remove `ADMIN_PASSWORD` from `.env.production` on VPS (seed already ran, no longer needed)
- [ ] Verify cookie has `Secure` flag (browser devtools > Application > Cookies)

## DNS / SSL
- [ ] Update STRATO nameservers to Cloudflare
- [ ] Cloudflare SSL mode set to "Full (strict)"
- [ ] Certbot cert obtained (`sudo certbot --nginx -d taste.tech`)
- [ ] Verify HTTPS: `curl -I https://taste.tech`
- [ ] SSL Labs test: https://www.ssllabs.com/ssltest/analyze.html?d=taste.tech

## Firewall / Access
- [ ] UFW enabled with only 22, 80, 443, 9002
- [ ] Verify with `sudo ufw status`
- [ ] SSH key auth only (disable password auth in `/etc/ssh/sshd_config` if not already)

## App verification
- [ ] Dashboard loads
- [ ] Login works
- [ ] WebSocket connects (devtools > Network > WS)
- [ ] Push notification prompt appears and works
- [ ] Security headers present: `curl -I https://taste.tech`

## Ongoing
- [ ] PM2 survives reboot: `sudo reboot`, then check `pm2 status`
- [ ] SQLite backups running: check `/opt/taste-backups/` after 3 AM
- [ ] Set up SSH key auth if using password auth
- [ ] Keep Ubuntu updated: `sudo apt update && sudo apt upgrade`
