# Arhat Management System (Rehmani Trading ERP)

Full-stack grain trading & commission agency (**arhat**) management system.

**Repo:** https://github.com/ahsanidreesnns8-ai/Arhat-Management-System

## Deploy on Vercel (recommended)

The production app lives in **`web/`** — **Next.js + TypeScript** (UI + API), ready for `*.vercel.app`.

| Step | Action |
|------|--------|
| 1 | Import this GitHub repo in [vercel.com/new](https://vercel.com/new) |
| 2 | Set **Root Directory** → `web` |
| 3 | Add env `DATABASE_URL` (Postgres, e.g. free [Neon](https://neon.tech)) and `JWT_SECRET` |
| 4 | Deploy → open your `https://….vercel.app` link |

Details: [`web/README.md`](web/README.md)

**Default login:** `owner` / `admin123`

---

## Stack

| Layer | Technology |
|-------|------------|
| **Vercel app** | Next.js 15 · TypeScript · Prisma · PostgreSQL |
| Legacy (optional) | `frontend/` React+Vite · `backend/` Java Spring Boot · MySQL |

```
├── web/          ← deploy this to Vercel (TypeScript full-stack)
├── backend/      Legacy Spring Boot API (Java 17)
├── frontend/     Legacy Vite SPA
├── database/     MySQL schema pack + Workbench SQL queries
├── docker-compose.yml
└── PROJECT_STRUCTURE.md
```

### Website routes

| URL | Purpose |
|-----|---------|
| `/` | Public landing |
| `/features` `/how-it-works` `/about` `/contact` | Marketing |
| `/login` | Staff login |
| `/dashboard` … | Authenticated ERP |

---

## Local quick start (Vercel / TypeScript app)

```bash
cd web
cp .env.example .env   # set DATABASE_URL to your Postgres
npm install
npx prisma db push
npm run db:seed
npm run dev
```

- App: http://localhost:3000

## Legacy stack (Java + Vite + MySQL)

See previous docs / Docker:

```bash
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| UI | http://localhost:5173 |
| API | http://localhost:8080/api |
| MySQL | localhost:3306 |

## Modules

Dashboard · Farmers · Buyers · Trucks · Dheris · Stock · Price Calculator · Farmer Product · Daily Trade · Queue · Sales · Payments · Records · Reports · Settings · Owner Panel · AI Assistant · Global Search · Bilingual bills

## AI keys (server env only)

```bash
GEMINI_API_KEY=...
GROQ_API_KEY=...   # optional
```
