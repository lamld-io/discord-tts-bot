# ============================================
# Stage 1: Build backend (TypeScript → JS)
# ============================================
FROM node:22-slim AS builder

# Build tools cho native modules (better-sqlite3, sodium-native, @discordjs/opus)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files trước để tận dụng Docker layer cache
COPY package*.json ./
RUN npm ci

# Copy source và build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune devDependencies, chỉ giữ production deps
RUN npm prune --omit=dev

# ============================================
# Stage 2: Build frontend (React/Vite)
# ============================================
FROM node:22-slim AS frontend

WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:22-slim AS runtime

# Chỉ cài ffmpeg cho audio processing + curl cho healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production node_modules từ builder (đã prune, đã build native modules)
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/package.json ./

# Copy built backend từ stage 1
COPY --from=builder /app/dist/ ./dist/

# Copy built frontend từ stage 2
COPY --from=frontend /app/web/dist/ ./web/dist/

# Tạo thư mục data cho SQLite
RUN mkdir -p /app/data && chown -R node:node /app/data

# Healthcheck: thử web endpoint, fallback kiểm tra node process
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:3000/api/bot/status || pgrep -x node > /dev/null

# Chạy với non-root user
USER node

# Expose web dashboard port
EXPOSE 3000

# Default environment
ENV NODE_ENV=production
ENV DB_PATH=/app/data/bot.db

CMD ["node", "dist/index.js"]
