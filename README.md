# Arhat Management System

Shop software for **Rehmani Trading Company** — grain arhat (commission agency) work: farmers, buyers, stock, bills, register, and khata books.

**Live website:** https://arhat-management-system.vercel.app  
**Code (your GitHub):** https://github.com/ahsanidreesnns8-ai/Arhat-Management-System

This app is yours. It runs on **your GitHub**, **your Vercel**, and **your Postgres (Neon)**. It does not need Cursor, Cloud Agents, or any AI subscription to stay online.

---

## Who owns what

| Piece | Owner | What it does |
|---|---|---|
| GitHub repo | Your GitHub user `ahsanidreesnns8-ai` | Stores the source code |
| Vercel project | Your Vercel account (connected to that GitHub repo) | Hosts the live website |
| Neon / Postgres | Your database account | Stores farmers, buyers, stock, bills, register |
| Cursor | A coding editor only | Can *change code* while you use it. It does **not** own the site, the database, or GitHub |

After a Cursor plan ends, the shop URL and logins keep working. Only new AI code edits from Cursor stop.

To disconnect Cursor from GitHub (optional): GitHub → **Settings** → **Applications** → **Installed GitHub Apps** → uninstall **Cursor**. Vercel and Neon stay as they are. Do not delete the GitHub repo, the Vercel project, or the Neon project.

---

## You can change this README

Yes. `README.md` is a normal file in your repo. You do not need Cursor to edit it.

**On GitHub (easiest):**

1. Open the repo → click `README.md`
2. Click the pencil (Edit)
3. Write your explanation in Markdown
4. Click **Commit changes** to `main`

Vercel will redeploy from `main`. That does not wipe shop data.

You can also edit any other `.md` file the same way (`DEPLOY.md`, `web/README.md`).

---

## Logins

Change the owner password in **Owner Panel** after you are in. Demo data never writes into the live shop.

| Username | Password | Shop |
|---|---|---|
| `owner` | `Nankana#Shop9472Rtc` | Live business |
| `hasham` | `hasham123` | Demo sandbox only |

---

## What the shop does

| Area | Purpose |
|---|---|
| Dashboard | Daily overview |
| Farmers / Buyers | IDs, product, sales, balances |
| Trucks / Dheris / Queue | Incoming grain |
| Stock / Daily Trade | Bags, extra kg, selling |
| Price Calculator | Rate and commission |
| Sales / Payments / Records | Money in and out |
| Arhat Register | People, receive, give, ledger, zakat, farmer advance |
| Wheat / Paddy / other khata | Named grain books |
| Bills | Print farmer, buyer, register, and balance slips |
| Reports / Settings / Owner Panel | Totals, users, passwords |
| AI Assistant | Optional. Shop questions work without a Gemini key |

Public pages: `/` landing, `/features`, `/how-it-works`, `/about`, `/contact`. Shop work starts at `/login`.

---

## How the live site stays up

1. You push (or merge) code to GitHub branch **`main`**
2. Vercel builds the app from folder **`web/`**
3. The site reads the database using `DATABASE_URL` in Vercel → Settings → Environment Variables

Required for the live shop:

- `DATABASE_URL` — Postgres connection string from Neon (or any Postgres)

Optional:

- `JWT_SECRET` — login tokens (a built-in secret is used if this is missing)
- `GEMINI_API_KEY` — only for general questions in the AI assistant

Cursor is not an environment variable and is not used when a farmer bill is printed.

More deploy detail: [`DEPLOY.md`](DEPLOY.md) and [`web/README.md`](web/README.md).

---

## Folders

```
web/          ← the live app (deploy this on Vercel)
backend/      Legacy Java API (not used on Vercel)
frontend/     Legacy Vite UI (not used on Vercel)
database/     Old MySQL notes
```

---

## Run on your computer (optional)

You need Node.js and a Postgres database.

```bash
cd web
cp .env.example .env   # put your DATABASE_URL in .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

---

## If something stops working later

That will be hosting or the database, not Cursor ending.

| Problem | Where to look |
|---|---|
| Website will not open | Vercel → Project → Deployments |
| Login or data errors | Neon dashboard, and Vercel env `DATABASE_URL` |
| New deploys stop | GitHub repo still connected in Vercel, production branch `main` |
| AI assistant general questions fail | Gemini key in Settings; shop screens still work |

Keep your GitHub, Vercel, and Neon logins in a password manager. Those three are the shop. Cursor is not.
