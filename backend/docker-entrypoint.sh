#!/bin/sh
set -e

echo "▶ Applying database migrations..."
npx prisma migrate deploy

echo "▶ Seeding database (idempotent)..."
npx tsx prisma/seed.ts || echo "⚠ Seed step failed — continuing"

echo "▶ Starting API server..."
exec node dist/server.js
