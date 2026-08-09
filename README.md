# Rehmani Trading Company — Enterprise ERP

Grain trading & commission agency (arhat) management system.

**Stack:** React + Vite + Tailwind · Java Spring Boot · MySQL · JWT

## Quick start

### Prerequisites
- Java 17+
- Node.js 18+
- MySQL 8+ (or use the included Docker Compose)

### Database
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS rehmani_trading;"
```

Default Flyway migrations create schema, products, and owner user.

### Backend
```bash
cd backend
# optional: export SPRING_DATASOURCE_PASSWORD=yourpassword
mvn spring-boot:run
```
API: `http://localhost:8080/api`  
Health: `http://localhost:8080/api/health`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App: `http://localhost:5173`

### Default login
| Field | Value |
|-------|-------|
| Username | `owner` |
| Password | `admin123` |

Change this password immediately in production.

### Docker Compose (MySQL + API + UI)
```bash
docker compose up -d --build
```
- UI: http://localhost:5173  
- API: http://localhost:8080/api  
- MySQL: localhost:3306

## Modules
Dashboard · Farmers · Buyers · Trucks · Dheris · Stock · Price Calculator · Queue · Sales (mixed-source) · Records · Reports (Excel/PDF/Print) · Settings · Owner Panel · AI Assistant · Global Search · Bills

## Project layout
```
backend/     Spring Boot REST API
frontend/    React (Vite) SPA
docker-compose.yml
```
