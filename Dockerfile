# Dockerfile - Morozka 2.0 Unified Container
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json for concurrently
COPY package.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# --- Production Image ---
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Ensure tsx is available from server deps
RUN npm install -g tsx

EXPOSE 3001

CMD ["tsx", "server/index.ts"]
