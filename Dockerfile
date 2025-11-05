# Build stage
FROM node:20-slim AS builder

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Copy JSON config files that TypeScript doesn't copy
RUN mkdir -p dist/config && cp src/config/widgets.json dist/config/widgets.json

# Production stage
FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Generate Prisma client in production
RUN npx prisma generate

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Start command
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
