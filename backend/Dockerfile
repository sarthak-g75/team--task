# syntax=docker/dockerfile:1

# ---- Builder: install all deps, generate Prisma client, compile TS ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json prisma.config.ts ./
RUN npx prisma generate

COPY src ./src
RUN npm run build

# ---- Runner: production image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Carry over installed deps (incl. generated Prisma client, the prisma CLI for
# migrate deploy, and tsx for the seed) plus the compiled output.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json prisma.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
