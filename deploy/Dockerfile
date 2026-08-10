# Production all-in-one image: Spring Boot API + React UI (nginx)
# Serves UI on :80 and proxies /api → backend :8080

FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src ./src
RUN mvn -q -DskipTests package \
 && cp target/*.jar /app/app.jar

FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM eclipse-temurin:17-jre
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx curl \
 && rm -rf /var/lib/apt/lists/* \
 && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY --from=backend-build /app/app.jar /app/app.jar
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY deploy/nginx-prod.conf /etc/nginx/conf.d/default.conf
COPY deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh \
 && mkdir -p /app/data

ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_PORT=8080 \
    JAVA_OPTS="-Xms256m -Xmx768m"

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
