#!/usr/bin/env bash
set -euo pipefail

# Generate JWT secret if not provided
if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n')"
  export JWT_SECRET
  echo "[deploy] Generated ephemeral JWT_SECRET for this container start"
fi

# CORS: allow all origins for single-host deploy (same nginx serves UI + API)
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-*}"

echo "[deploy] Starting nginx…"
nginx

echo "[deploy] Starting Spring Boot (profile=${SPRING_PROFILES_ACTIVE:-prod})…"
exec java ${JAVA_OPTS:-} -jar /app/app.jar
