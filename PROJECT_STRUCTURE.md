# Project Structure

```
Arhat-Management-System-/
├── README.md                 # Quick start & overview
├── PROJECT_STRUCTURE.md      # This file
├── docker-compose.yml        # MySQL + backend + frontend
├── .gitignore
│
├── backend/                  # Spring Boot 3 REST API (Java 17)
│   ├── Dockerfile
│   ├── pom.xml
│   ├── README.md
│   └── src/main/
│       ├── java/com/rehmani/trading/
│       │   ├── RehmaniTradingApplication.java
│       │   ├── config/         # Security, CORS, OpenAPI, etc.
│       │   ├── controller/     # REST endpoints
│       │   ├── dto/            # Request/response models
│       │   ├── entity/         # JPA entities
│       │   ├── exception/      # API error handling
│       │   ├── repository/     # Spring Data JPA
│       │   ├── security/       # JWT auth filters
│       │   └── service/        # Business logic
│       └── resources/
│           ├── application.yml
│           ├── application-dev.yml
│           ├── db/migration/   # Flyway SQL (runtime source of truth)
│           └── static/
│
├── frontend/                 # React + Vite + Tailwind SPA
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── README.md
│   ├── public/               # Static assets (logos)
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── components/
│       │   ├── ai/           # AI assistant panel
│       │   ├── auth/         # Protected routes
│       │   ├── brand/        # Logo
│       │   ├── forms/
│       │   ├── layout/       # Shell, sidebar, navbar, ambient scene
│       │   ├── motion/
│       │   ├── payments/
│       │   └── ui/           # Buttons, cards, modals, etc.
│       ├── context/          # Auth, theme, language, business
│       ├── i18n/             # EN / UR translations
│       ├── pages/            # Route screens
│       ├── services/         # API client
│       ├── types/
│       └── utils/
│
└── database/                 # MySQL Workbench pack (docs + queries)
    ├── README.md
    ├── migrations/           # Copy of Flyway V1–V6 for inspection
    ├── schema/               # Create-database helpers
    ├── queries/              # Ready SQL reports
    └── seed/                 # Seed notes
```

## How the three folders relate

| Folder | Role |
|--------|------|
| `backend/` | API server; applies Flyway from `backend/src/main/resources/db/migration/` |
| `frontend/` | Browser UI talking to `/api` |
| `database/` | Human-friendly SQL pack for MySQL Workbench (mirrors migrations + reports) |

Keep `database/migrations/` in sync when you add a new Flyway file under the backend.
