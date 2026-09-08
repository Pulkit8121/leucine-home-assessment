#!/bin/sh
# Apply migrations, seed once, then hand over to the server as PID 1 so signals
# reach it and the graceful shutdown handler actually runs.
set -e
echo "Applying migrations..."
npx prisma migrate deploy
echo "Seeding (idempotent)..."
node dist/prisma/seed.js || echo "Seed skipped."
exec node dist/src/index.js
