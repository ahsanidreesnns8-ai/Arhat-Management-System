# Deploy

## Vercel (TypeScript / Next.js) — easiest `*.vercel.app` link

1. Open [vercel.com/new](https://vercel.com/new) and import this GitHub repository.
2. **Root Directory:** `web`
3. **Environment variables:**

| Name | Required | Notes |
|------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL URL ([Neon](https://neon.tech) free tier is fine) |
| `JWT_SECRET` | Yes | Long random string |
| `GEMINI_API_KEY` | No | AI assistant |
| `GROQ_API_KEY` | No | AI fallback |

4. Deploy. Build command is `npm run vercel-build` (Prisma generate → db push → seed → Next build).
5. Use the generated URL, e.g. `https://arhat-management-system.vercel.app`.

Local instructions: [`web/README.md`](web/README.md)

---

## Legacy: Render / Docker (Java + MySQL)

The original Spring Boot + Vite + MySQL stack still lives in `backend/`, `frontend/`, and `docker-compose.yml`.

See `render.yaml` and the Dockerfiles under `backend/`, `frontend/`, and `deploy/` if you prefer that path.
