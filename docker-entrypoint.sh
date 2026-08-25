#!/bin/sh
# 𝒾Pastor container entrypoint.
#
# Applies any outstanding database migrations before serving, so the schema and
# the running code never drift apart. `migrate deploy` only applies migrations
# that already exist — it never generates or guesses one, and it never resets.
set -e

echo "iPastor: applying database migrations…"
cd /app/apps/web
npx prisma migrate deploy
cd /app

if [ "${SEED_ON_START}" = "true" ]; then
  echo "iPastor: running the bootstrap seed…"
  cd /app/apps/web && npx tsx prisma/seed.ts && cd /app
fi

echo "iPastor: starting."
exec "$@"
