#!/bin/bash
set -e

npx prisma migrate reset --force
npx prisma migrate dev --name auth-single-tenant
npx tsx prisma/seed.ts
