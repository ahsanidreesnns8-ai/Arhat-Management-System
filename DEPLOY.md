# Deploy

This ERP is a **standalone Vercel app**. It does not use Cursor Cloud Agents, tunnels, or any temporary demo URL. Cancelling a Cursor plan does **not** stop the website once it is deployed on Vercel.

Production URL: `https://arhat-management-system.vercel.app`

## What the live site needs (only these)

| Name | Required | Where |
|------|----------|--------|
| `DATABASE_URL` | Yes | Vercel → Project → Settings → Environment Variables. PostgreSQL from [Neon](https://neon.tech) (free tier is enough). |
| `JWT_SECRET` | No | Optional. A built-in secret is used if this is missing so login does not break. |
| `GEMINI_API_KEY` | No | AI assistant only |

Cursor is **not** an environment variable and is **not** part of runtime.

## Vercel project settings (one-time)

1. Import this GitHub repository at [vercel.com/new](https://vercel.com/new).
2. **Root Directory:** `web` (Settings → Build and Deployment). If this is empty, `npm install` fails with ENOENT.
3. **Production Branch:** `main` (so the site does not depend on Cloud Agent branches).
4. Add `DATABASE_URL`.
5. Deploy. Build command is `npm run vercel-build` (Prisma generate → db push → seed → Next build).

Shop logins are restored on every deploy and on every login:

| Username | Password |
|----------|----------|
| `owner` | `owner123` |
| `staff` | `staff123` |

Local instructions: [`web/README.md`](web/README.md)

---

## Legacy: Render / Docker (Java + MySQL)

The original Spring Boot + Vite + MySQL stack still lives in `backend/`, `frontend/`, and `docker-compose.yml`.

See `render.yaml` and the Dockerfiles under `backend/`, `frontend/`, and `deploy/` if you prefer that path.
