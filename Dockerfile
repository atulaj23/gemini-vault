# =========================
# Build Stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Root workspace files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY backend ./backend
COPY frontend ./frontend

# Build backend + frontend
RUN npm run build

# =========================
# Runtime Stage
# =========================
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Root workspace files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Backend build
COPY --from=builder /app/backend/dist ./backend/dist

# Frontend build
COPY --from=builder /app/frontend/dist ./frontend-dist

# Backend package if needed at runtime
COPY --from=builder /app/backend/package.json ./backend/package.json

USER appuser

EXPOSE 8080

CMD ["node", "backend/dist/server.js"]