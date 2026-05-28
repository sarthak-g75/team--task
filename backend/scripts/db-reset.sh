#!/bin/bash
set -e

npx prisma migrate reset --force
npx prisma migrate dev --name init-auth
