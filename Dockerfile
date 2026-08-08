# --- Stage 1: build the React frontend ---
FROM node:20-bookworm AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: backend + local Whisper (whisper.cpp via nodejs-whisper) ---
FROM node:20-bookworm AS backend

# build-essential/cmake/git = compile whisper.cpp; ffmpeg = audio conversion + ffprobe duration checks
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake git ffmpeg curl wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./public

ENV WHISPER_MODEL_ROOT=/app/whisper-models
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
# Some aarch64 GCC versions choke (fp16 NEON "always_inline" errors) on whisper.cpp's
# auto-detected -march=native flags. Building generic (non-native) CPU kernels avoids it
# and is still correct/portable across ARM64 hosts (just skips a few micro-optimizations).
ENV NODEJS_WHISPER_CMAKE_ARGS=-DGGML_NATIVE=OFF

# Warm up the build: this compiles whisper.cpp once (cached for every model after)
# and bakes in the ggml weights for all three plan tiers, so containers start
# instantly with no first-request compile/download delay.
RUN ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 1 -ar 16000 -ac 1 -c:a pcm_s16le scripts/warmup.wav \
    && node scripts/warmup-model.js tiny \
    && node scripts/warmup-model.js base \
    && node scripts/warmup-model.js small \
    && rm -f scripts/warmup.wav scripts/warmup*.txt scripts/warmup*.json

VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "src/server.js"]
