# ─────────────────────────────────────────────────────────────────────────────
# 𝒾Pastor — production image
#
# Multi-stage so the runtime image carries only the built application and its
# production dependencies. Runs as a non-root user, and applies database
# migrations at container start so a deploy and its schema move together.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=apps/web --include-workspace-root

# ── Build ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY apps/web ./apps/web

WORKDIR /app/apps/web

# The build needs a DATABASE_URL present for `prisma generate`, but never
# connects to it: every page that reads the database is force-dynamic.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ENV DATA_ENCRYPTION_KEY="build-time-placeholder-not-used-at-runtime"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

WORKDIR /app/apps/web

# Next's standalone output plus the static assets it does not inline.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone /app
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public /app/apps/web/public

# Prisma schema, migrations and engine, so the container can migrate on start.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma /app/apps/web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma /app/node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma /app/node_modules/.prisma

COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# The container is unhealthy if the database probe fails, so an orchestrator
# stops routing traffic to an instance that cannot serve anyone.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
