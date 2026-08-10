# Arhat Management System (Rehmani Trading ERP)

Full-stack grain trading & commission agency (**arhat**) management system.

**Repo:** https://github.com/ahsanidreesnns8-ai/Arhat-Management-System-

**Stack:** React + Vite + Tailwind · Java Spring Boot 3 · MySQL · JWT · Flyway

---

## Repository layout

```
├── backend/      Spring Boot REST API (Java 17)
├── frontend/     React (Vite) SPA — premium 3D glass UI
├── database/     MySQL schema pack + Workbench SQL queries
├── docker-compose.yml
└── PROJECT_STRUCTURE.md
```

See **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** for the full tree.  
Folder guides: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md) · [database/README.md](database/README.md)

---

## Quick start

### Prerequisites
- Java 17+
- Node.js 18+
- MySQL 8+ *(or Docker Compose)*

### 1) Database
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS rehmani_trading;"
```
Or open `database/schema/01_create_database.sql` in MySQL Workbench.

### 2) Backend
```bash
cd backend
mvn spring-boot:run
```
- API: `http://localhost:8080/api`
- Health: `http://localhost:8080/api/health`

### 3) Frontend
```bash
cd frontend
npm install
npm run dev
```
- App: `http://localhost:5173`

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
| Service | URL |
|---------|-----|
| UI | http://localhost:5173 |
| API | http://localhost:8080/api |
| MySQL | localhost:3306 (`root` / `root`) |

---

## Modules
Dashboard · Farmers · Buyers · Trucks · Dheris · Stock · Price Calculator · Farmer Product · Arhat Sale · Queue · Sales · Payments · Records · Reports · Settings · Owner Panel · AI Assistant (voice) · Global Search · Bilingual bills

## AI Assistant
Server-side keys only (not in Settings UI):

```bash
export GEMINI_API_KEY=your_key_here
# optional:
export GROQ_API_KEY=your_groq_key
```

## Database / MySQL Workbench
See [`database/README.md`](database/README.md) for migrations, seed notes, and ready queries (`queries/01` … `07`).
