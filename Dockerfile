FROM node:20-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Copiar manifests primero para cachear el pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Copiar código fuente (incluye apps/dashboard/.env.local escrito por el deploy script)
COPY . .
RUN pnpm --filter @agentes/dashboard build

# --- runner: imagen de producción mínima ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME="0.0.0.0" TZ="America/Mexico_City"
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder --chown=nextjs:nodejs \
     /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs \
     /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
