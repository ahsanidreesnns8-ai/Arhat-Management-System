# Frontend — React SPA

React · Vite · TypeScript · Tailwind · Framer Motion

## Run locally

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`  
API proxy / base URL targets the backend at `http://localhost:8080/api`.

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
