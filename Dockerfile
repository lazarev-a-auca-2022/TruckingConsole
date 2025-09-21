FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./


# Install dependencies (including sharp and canvas for PNG generation)
RUN apk add --no-cache --virtual .gyp python3 make g++ \
    && apk add --no-cache pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev \
    && npm install --only=production \
    && npm install sharp canvas \
    && apk del .gyp

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
