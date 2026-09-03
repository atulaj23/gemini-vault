# =========================
# BUILD STAGE
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Root workspace files
COPY package.json package-lock.json ./

# Workspace package files
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

# Install all dependencies, including devDependencies
RUN npm install

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# -------------------------------------------------
# Firebase public config
# Render automatically provides these as build args
# -------------------------------------------------
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

# Make Firebase variables available to Vite
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# Safe diagnostic — NEVER print API key
RUN echo "Firebase Project ID: ${VITE_FIREBASE_PROJECT_ID}" && \
    echo "Firebase Auth Domain: ${VITE_FIREBASE_AUTH_DOMAIN}" && \
    echo "Firebase App ID: ${VITE_FIREBASE_APP_ID}"

# Build backend + frontend
RUN npm run build


# =========================
# RUNTIME STAGE
# =========================
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Root package files
COPY package.json package-lock.json ./

# Workspace package files
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

# Production dependencies only
RUN npm install --omit=dev

# Backend compiled output
COPY --from=builder /app/backend/dist ./backend/dist

# Frontend compiled output
COPY --from=builder /app/frontend/dist ./frontend-dist

# Run as non-root
USER appuser

EXPOSE 8080

CMD ["node", "backend/dist/index.js"]