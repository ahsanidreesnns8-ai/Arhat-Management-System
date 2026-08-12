# Project Structure

```
Arhat-Management-System/
├── README.md
├── DEPLOY.md
├── PROJECT_STRUCTURE.md
├── docker-compose.yml          # Legacy Java stack
├── render.yaml                 # Legacy Render blueprint
│
├── web/                        # ★ Vercel app (Next.js + TypeScript)
│   ├── package.json
│   ├── vercel.json
│   ├── prisma/
│   │   ├── schema.prisma       # PostgreSQL models
│   │   └── seed.ts
│   └── src/
│       ├── app/
│       │   ├── api/[...path]/  # TypeScript REST API (replaces Java)
│       │   ├── [[...slug]]/    # SPA shell (React Router UI)
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── client/             # Ported React UI (from frontend/)
│       └── server/             # Auth, Prisma services, money/ID helpers
│
├── backend/                    # Legacy Spring Boot 3 (Java 17)
├── frontend/                   # Legacy React + Vite SPA
├── database/                   # MySQL Workbench pack
└── deploy/                     # Legacy all-in-one Docker
```

## Languages

| Path | Language / runtime |
|------|--------------------|
| `web/` | **TypeScript** (Next.js, Prisma, React) |
| `backend/` | Java (Spring Boot) — legacy |
| `frontend/` | TypeScript/TSX (Vite) — legacy |
| `database/` | SQL |

## How folders relate

| Folder | Role |
|--------|------|
| `web/` | Single deployable app for Vercel (`*.vercel.app`) |
| `backend/` + `frontend/` | Original split stack (optional / Docker) |
| `database/` | MySQL docs mirroring Flyway migrations |
