# Frontend — React SPA

React · Vite · TypeScript · Tailwind · Framer Motion

## Run locally

Backend must be running first (otherwise Dashboard/Stock show empty / errors):

```bash
# terminal 1 — API
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# terminal 2 — UI
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`  
Vite proxies `/api` → `http://127.0.0.1:8080`. If Stock/Dashboard fail, hard-refresh after both processes are up.

## Build

```bash
npm run build
```

## Source layout

```
src/
├── components/     UI building blocks + app shell
│   ├── ai/
│   ├── auth/
│   ├── brand/
│   ├── layout/     Sidebar, Navbar, AmbientScene
│   ├── payments/
│   └── ui/
├── context/        Auth, Theme, Language, Business
├── i18n/           English / Urdu strings
├── pages/          Route-level screens
├── services/       Axios API client
├── types/
└── utils/          Formatters, motion presets
```

## Default login

| Field | Value |
|-------|-------|
| Username | `owner` |
| Password | `admin123` |

## Docker

Built from this folder via root `docker-compose.yml` (`frontend` service, port `5173` → nginx).
