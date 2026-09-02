# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency install
COPY backend/package*.json ./

# Install all deps (including dev for build)
RUN npm ci

# Copy source
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

WORKDIR /app

# Copy production artifacts
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

# Switch to non-root user
USER appuser

# Cloud Run provides PORT — default 8080
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT}/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
