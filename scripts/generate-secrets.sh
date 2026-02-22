#!/usr/bin/env bash
# Generate production secrets for Taste
# Usage: bash scripts/generate-secrets.sh

set -euo pipefail

echo "=== Taste Production Secrets ==="
echo ""
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "EMAIL_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo ""
echo "# VAPID keys for push notifications:"
npx web-push generate-vapid-keys 2>/dev/null || echo "# Run 'npx web-push generate-vapid-keys' manually"
echo ""
echo "# Copy the above values into your .env.production file"
