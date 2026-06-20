# ai-edu backend Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3 + curl for healthcheck
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Build native modules
RUN npm rebuild better-sqlite3

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Health check - bypass proxy
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD no_proxy=localhost curl -sf http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
