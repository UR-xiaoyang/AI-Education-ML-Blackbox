# ai-edu frontend Dockerfile (multi-stage)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the app. API calls use same-origin /api and are proxied at runtime.
RUN npm run build

# Production stage - serve with Express proxy
FROM node:22-alpine

WORKDIR /app

# Copy proxy and built assets
COPY backend/proxy.js ./
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 80

ENV API_URL=http://backend:3001
ENV PORT=80

CMD ["node", "proxy.js"]
