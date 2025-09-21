FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./


# Install system dependencies for canvas and sharp
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev

# Install Node.js dependencies
RUN npm install --only=production

# Install sharp and canvas with increased timeout and memory
RUN npm install --verbose --timeout=300000 sharp

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY debug-png.js ./
COPY quick-test.js ./
COPY container-test.js ./
COPY simple-test.js ./
COPY route-test.js ./
COPY complete-test.js ./
COPY .env.example ./.env

# Create uploads directory
RUN mkdir -p uploads temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node src/health-check.js || exit 1

# Start application
CMD ["npm", "start"]
