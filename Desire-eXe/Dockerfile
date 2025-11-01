FROM node:22-alpine

# Install FFmpeg and other dependencies
RUN apk add --no-cache \
    ffmpeg \
    git \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies with legacy peer deps to avoid conflicts
RUN npm install --legacy-peer-deps

# Copy all source code
COPY . .

# Expose port
EXPOSE 8000

# Start the application
CMD ["node", "app.js"]
