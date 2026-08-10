# Backend — Spring Boot API

Java 17 · Spring Boot 3 · Spring Security (JWT) · Flyway · MySQL / H2 (dev)

## Run locally

```bash
cd backend
# Optional: MySQL password
# export SPRING_DATASOURCE_PASSWORD=yourpassword
mvn spring-boot:run
```

- API base: `http://localhost:8080/api`
- Health: `http://localhost:8080/api/health`
- Dev profile (H2): `mvn spring-boot:run -Dspring-boot.run.profiles=dev`

## Package layout

```
src/main/java/com/rehmani/trading/
├── config/       Security, CORS, beans
├── controller/   REST controllers
├── dto/          API contracts
├── entity/       JPA entities
├── exception/    Error responses
├── repository/   Data access
├── security/     JWT filter & helpers
└── service/      Domain / business logic
```

## Migrations

Flyway scripts live in:

```
src/main/resources/db/migration/
```

A readable copy for Workbench is also under `/database/migrations/`.

## Docker

Built from this folder via root `docker-compose.yml` (`backend` service, port `8080`).

## AI keys (optional)

```bash
export GEMINI_API_KEY=...
export GROQ_API_KEY=...
```

## Production security (recommended)

```bash
export JWT_SECRET='use-a-long-random-secret'
export CORS_ALLOWED_ORIGINS='https://your-domain.com,https://www.your-domain.com'
```

Concurrent logins (same `owner` / password on multiple devices) are supported. Shared data stays in sync via `/api/sync/pulse`. Weather area and Islamic calendar correction are managed in Settings.
