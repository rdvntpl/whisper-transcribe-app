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

# Warm up the build: this compiles whisper.cpp once (cached for every model after)
# and bakes in the ggml weights for all three plan tiers, so containers start
# instantly with no first-request compile/download delay.
RUN ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 1 -ar 16000 -ac 1 -c:a pcm_s16le /tmp/warmup.wav \
    && node -e "const {nodewhisper}=require('nodejs-whisper'); nodewhisper('/tmp/warmup.wav',{modelName:'tiny',autoDownloadModelName:'tiny',modelRootPath:process.env.WHISPER_MODEL_ROOT,whisperOptions:{outputInText:true}}).then(()=>console.log('tiny ready')).catch(e=>{console.error(e);process.exit(1)})" \
    && node -e "const {nodewhisper}=require('nodejs-whisper'); nodewhisper('/tmp/warmup.wav',{modelName:'base',autoDownloadModelName:'base',modelRootPath:process.env.WHISPER_MODEL_ROOT,whisperOptions:{outputInText:true}}).then(()=>console.log('base ready')).catch(e=>{console.error(e);process.exit(1)})" \
    && node -e "const {nodewhisper}=require('nodejs-whisper'); nodewhisper('/tmp/warmup.wav',{modelName:'small',autoDownloadModelName:'small',modelRootPath:process.env.WHISPER_MODEL_ROOT,whisperOptions:{outputInText:true}}).then(()=>console.log('small ready')).catch(e=>{console.error(e);process.exit(1)})" \
    && rm -f /tmp/warmup.wav /tmp/warmup*.json

VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "src/server.js"]
