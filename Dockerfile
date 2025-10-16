FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./


# Install system dependencies for canvas and sharp + ImageMagick for PDF conversion
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    imagemagick \
    ghostscript

# Install Node.js dependencies
RUN npm install --only=production

# Install sharp and canvas with increased timeout and memory
RUN npm install --verbose --timeout=300000 sharp

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY outputs/ ./outputs/
COPY .env.example ./

# Create required directories
RUN mkdir -p uploads temp tests

# Copy tests (optional - for container testing)
COPY tests/ ./tests/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node src/health-check.js || exit 1

# Start application
CMD ["npm", "start"]
