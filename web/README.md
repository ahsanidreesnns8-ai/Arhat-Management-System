## One-click permanent Vercel link

1. Open: https://vercel.com/new/clone?repository-url=https://github.com/ahsanidreesnns8-ai/Arhat-Management-System&project-name=arhat-management-system&root-directory=web
2. Set **Root Directory** to `web` (if not prefilled).
3. Add env vars:
   - `DATABASE_URL` = your Neon Postgres URL (https://console.neon.tech)
   - `JWT_SECRET` = any long random string
4. Deploy → copy your permanent `https://….vercel.app` URL.

Login accounts are `owner` and `staff`. Seed **does not reset passwords** on deploy. Set unique passwords in **Owner Panel** (never reuse leaked passwords). The owner can add more users (name, username, password) and delete those extra users.

---

# Arhat Management System — Vercel / Next.js app

TypeScript full-stack port of the Java + Vite ERP, ready for **Vercel**.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Prisma** + **PostgreSQL** (Neon / Vercel Postgres / any Postgres)
- Same React UI (ported from Vite SPA)

## Local development

1. Create a Postgres database and set `DATABASE_URL` in `.env` (copy from `.env.example`).
2. Install & prepare DB:

```bash
cd web
npm install
npx prisma db push
npm run db:seed
npm run dev
```

App: http://localhost:3000  
API: http://localhost:3000/api  

On first seed of an empty database, set `OWNER_PASSWORD` and `STAFF_PASSWORD` in `.env` (10+ characters, letters and numbers). Seed never overwrites existing passwords.

Shop logins:
- `owner` — change the password in Owner Panel
- `staff` — change the password in Owner Panel
- Additional users created (and deleted) in Owner Panel

## AI Assistant (Gemini)

Business questions (stock, sales, farmers, queue) work without a key.

For world / general questions:

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and sign in.
2. Click **Create API key** and copy it.
3. Either:
   - Paste it in the app: **Settings → AI Assistant (Gemini) → Save All Settings**, or
   - Set `GEMINI_API_KEY` in `.env` (local) or Vercel → Project → Settings → Environment Variables, then redeploy.
4. Open the AI Assistant from the bottom dock and ask a general question (e.g. “What is wheat?”).

If both are set, the Vercel / `.env` key is used first.

## Deploy to Vercel (get a `*.vercel.app` link)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo.
3. Set **Root Directory** to `web`.
4. Add env vars:
   - `DATABASE_URL` — Postgres connection string ([Neon](https://neon.tech) free tier works)
   - `JWT_SECRET` — long random string
   - optional: `GEMINI_API_KEY`, `GROQ_API_KEY`
5. Deploy. Build uses `npm run vercel-build` (generate + db push + seed + next build).
6. Open the provided `https://….vercel.app` link.

### One-time Neon setup

1. Create a free project at neon.tech  
2. Copy the connection string → Vercel project env `DATABASE_URL`  
3. Redeploy if needed
