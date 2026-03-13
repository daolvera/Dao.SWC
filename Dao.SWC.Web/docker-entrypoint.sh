#!/bin/sh
set -eu

echo "Injecting runtime environment variables..."
envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/env.js

# Aspire/ACA sets PORT; default to 80 for local runs.
PORT="${PORT:-80}"
echo "Configuring nginx to listen on port ${PORT}..."
envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"