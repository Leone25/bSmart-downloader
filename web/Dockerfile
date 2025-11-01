# Dockerfile for Web UI service
FROM node:18-alpine

WORKDIR /app

# Copy root package files for downloader dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy web package files
COPY web/package*.json ./web/
WORKDIR /app/web
RUN npm ci --only=production

# Copy application files
WORKDIR /app
COPY index.js ./
COPY web ./web

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production \
    OUTPUT_DIR=/output \
    PORT=3000

# Start web server
CMD ["node", "web/backend/server.js"]

