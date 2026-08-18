#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN}"
: "${DATABASE_URL:?Set DATABASE_URL}"
JWT_SECRET="${JWT_SECRET:-RehmaniTradingCompanySecretKey2026EnterpriseERPSystemSecureToken}"

echo "Deploying web/ to Vercel production…"
npx vercel link --yes --token "$VERCEL_TOKEN" || true
npx vercel env add DATABASE_URL production --token "$VERCEL_TOKEN" --yes <<< "$DATABASE_URL" 2>/dev/null || true
npx vercel env add JWT_SECRET production --token "$VERCEL_TOKEN" --yes <<< "$JWT_SECRET" 2>/dev/null || true
npx vercel --prod --yes --token "$VERCEL_TOKEN"
