#!/bin/sh
set -eu
cd /app/apps/api
pnpm exec prisma migrate deploy
if [ "${SEED_DEMO:-true}" = "true" ]; then
  node dist-seed/prisma/seed.js
fi
exec node dist/main.js
