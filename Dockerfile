# ──────────────────────────────────────────────
# Stage 1: Build the React frontend
# ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install frontend dependencies
COPY frontend/package.json ./frontend/
RUN npm install --prefix frontend

# Copy source and build
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# ──────────────────────────────────────────────
# Stage 2: Production image (backend + static)
# ──────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install backend dependencies (production only)
COPY backend/package.json ./backend/
RUN npm install --prefix backend --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Data directory for SQLite (override with a volume in docker-compose)
RUN mkdir -p /data
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["node", "backend/src/index.js"]
