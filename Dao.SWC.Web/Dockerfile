# Stage 1: Build the Angular application
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm i

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS final

COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY src/assets/env.template.js /usr/share/nginx/html/assets/env.template.js

COPY --from=build /app/dist/Dao.SWC.Web/browser /usr/share/nginx/html

# Copy nginx config template (rendered at runtime using PORT)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Fix Windows CRLF line endings and make executable
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Expose common HTTP ports used by local hosts and ACA/Aspire
EXPOSE 80 4200 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
