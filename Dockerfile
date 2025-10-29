# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template - nginx will automatically substitute environment variables
COPY default.conf.template /etc/nginx/templates/

EXPOSE 8091

# nginx automatically processes templates in /etc/nginx/templates/ with envsubst
CMD ["nginx", "-g", "daemon off;"]
