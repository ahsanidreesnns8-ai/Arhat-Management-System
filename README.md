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

## AI Assistant
Answers **business data** (stock, queue, sales, balances) and **general world questions**.

**Recommended (pro-level):** In the app go to **Settings → AI Assistant**, paste a free Gemini key from https://aistudio.google.com/apikey, and Save. Then ask anything (including mandi/market rates).

Or via environment:

```bash
export GEMINI_API_KEY=your_key_here
# optional: export GROQ_API_KEY=... / OPENAI_API_KEY=...
```

Without a key, the assistant still uses Wikipedia/dictionary/weather/math and structured market guidance (never echoes junk answers).

## Project layout
```
backend/     Spring Boot REST API
frontend/    React (Vite) SPA
database/    MySQL schema pack + Workbench queries
docker-compose.yml
```

## Database / MySQL Workbench
See [`database/README.md`](database/README.md) for:
- Creating `rehmani_trading`
- Flyway migrations under `database/migrations/`
- Ready SQL queries for farmer payables, buyer receivables, dheri payments by day, and day cashbook

```sql
-- Quick connect after backend has run once
USE rehmani_trading;
SOURCE database/queries/01_overview_balances.sql;
```

## Arhat Sale
Sidebar → **Arhat Sale**: calculator-style product settlement for
- **Sell to Buyer** (receivable + optional cash now)
- **Farmer Product Payable** (posts payable + optional pay now)
Then open **Dheri detail** or **Payments** (date filter) for day-wise records.
