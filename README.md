🌾 Arhat Management System

### Rehmani Trading ERP

> **A modern full-stack grain trading & commission agency management system built to digitize, simplify, and manage daily arhat operations.**

![Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## 🌾 About the Project

**Arhat Management System (Rehmani Trading ERP)** is a full-stack business management platform designed for **grain traders, commission agents (Arhat), farmers, buyers, and trading businesses**.

The system replaces traditional paper-based record keeping with a centralized digital platform for managing:

* 👨‍🌾 Farmers
* 🏪 Buyers
* 🚚 Trucks
* 🌾 Dheris
* 📦 Stock
* 💰 Prices
* 🧾 Sales
* 💳 Payments
* 📊 Reports
* 📅 Daily Trading
* 🔎 Global Search
* 🤖 AI Assistant
* 👑 Owner Management
* 🧾 Bilingual Bills

The platform is designed with a modern interface, role-based authentication, database-backed records, reporting tools, and business-focused workflows.

---

# 🚀 Live Deployment

The production application is designed to run on:

**Vercel + PostgreSQL**


### Production Architecture

```text
User
  │
  ▼
Vercel
  │
  ├── Next.js Frontend
  ├── API Routes
  ├── Authentication
  └── Business Logic
          │
          ▼
     PostgreSQL
          │
          ▼
        Prisma
```

---

# ☁️ Deploy on Vercel

The recommended production application is located inside:

```text
web/
```

It contains the **Next.js + TypeScript full-stack application**.

## Deployment Steps

### 1. Import the repository

Import the GitHub repository into Vercel.

```text
https://github.com/ahsanidreesnns8-ai/Arhat-Management-System
```

### 2. Configure Root Directory

In Vercel:

```text
Root Directory → web
```

### 3. Configure PostgreSQL

Add the following environment variable:

```env
DATABASE_URL=your_postgresql_connection_string
```

You can use a PostgreSQL provider such as Neon.

### 4. Configure authentication secret

If the application configuration requires JWT authentication, add:

```env
JWT_SECRET=your_secure_random_secret
```

Generate a strong random value rather than committing a real production secret to GitHub.

Example:

```text
JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
```

### 5. Production Branch

Set:

```text
Production Branch → main
```

### 6. Deploy

Click:

```text
Deploy
```

After deployment, Vercel will provide a production URL similar to:

```text
https://your-project.vercel.app
```

---

# 🔐 Security

> ⚠️ **Never commit real passwords, API keys, database credentials, JWT secrets, or other private credentials to GitHub.**

Production credentials should be stored in:

```text
Vercel → Project → Settings → Environment Variables
```

For local development:

```text
web/.env
```

The `.env` file should remain excluded from Git.

Example:

```env
DATABASE_URL=your_database_url
JWT_SECRET=your_random_secret
GEMINI_API_KEY=your_api_key
```

### Default / Demo Accounts

For security reasons, **production owner credentials are intentionally not published in this README.**

If a fresh installation contains a seeded owner account, configure or change the credentials immediately after deployment.

Demo credentials, if enabled by the seed configuration, should only be used for testing.

---

# 🧰 Technology Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Frontend        | Next.js 15                       |
| Language        | TypeScript                       |
| UI              | React                            |
| Backend         | Next.js API                      |
| ORM             | Prisma                           |
| Database        | PostgreSQL                       |
| Deployment      | Vercel                           |
| Authentication  | JWT / Application Authentication |
| AI              | Google Gemini                    |
| Legacy Backend  | Java 17 + Spring Boot            |
| Legacy Frontend | React + Vite                     |
| Legacy Database | MySQL                            |

---

# 📁 Project Structure

```text
Arhat-Management-System/
│
├── web/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── prisma/
│   ├── public/
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
├── backend/
│   └── Spring Boot API
│
├── frontend/
│   └── React + Vite SPA
│
├── database/
│   └── MySQL schema & Workbench queries
│
├── screenshots/
│   ├── dashboard.png
│   ├── trading.png
│   └── management.png
│
├── docker-compose.yml
├── PROJECT_STRUCTURE.md
└── README.md
```

---

# 🖥️ Application Routes

## Public Pages

| Route           | Purpose              |
| --------------- | -------------------- |
| `/`             | Public landing page  |
| `/features`     | System features      |
| `/how-it-works` | Workflow explanation |
| `/about`        | About the system     |
| `/contact`      | Contact information  |
| `/login`        | Staff authentication |

## Protected Application

| Route           | Purpose                 |
| --------------- | ----------------------- |
| `/dashboard`    | Main business dashboard |
| `/farmers`      | Farmer management       |
| `/buyers`       | Buyer management        |
| `/trucks`       | Truck management        |
| `/dheris`       | Dheri management        |
| `/stock`        | Stock management        |
| `/sales`        | Sales management        |
| `/payments`     | Payment management      |
| `/records`      | Business records        |
| `/reports`      | Reports & analytics     |
| `/settings`     | System settings         |
| `/owner`        | Owner management        |
| `/ai-assistant` | AI business assistant   |

> Exact routes may vary depending on the current application implementation.

---

# 📦 Core Modules

### 👨‍🌾 Farmer Management

Manage farmer profiles, transactions, products, balances, and related trading records.

### 🏪 Buyer Management

Maintain buyer information and track purchases and transactions.

### 🚚 Truck Management

Record truck-related information associated with incoming and outgoing grain transactions.

### 🌾 Dheri Management

Manage grain lots/dheris and their associated trading information.

### 📦 Stock Management

Track available grain stock and inventory movement.

### 💰 Price Calculator

Calculate trading prices and transaction amounts quickly.

### 🌱 Farmer Product

Manage agricultural products associated with farmers and trading operations.

### 📅 Daily Trade

Maintain day-to-day trading activity in a centralized system.

### 🚦 Queue Management

Organize incoming trading operations and processing queues.

### 💵 Sales

Record and manage sales transactions.

### 💳 Payments

Track payments and financial transactions.

### 📚 Records

Maintain searchable historical business records.

### 📊 Reports

Generate useful business reports for management and decision-making.

### ⚙️ Settings

Configure application preferences and operational settings.

### 👑 Owner Panel

Provides administrative functionality for authorized system owners.

### 🤖 AI Assistant

Provides an AI-powered interface for business-related questions and general queries.

### 🔎 Global Search

Quickly locate business records throughout the system.

### 🧾 Bilingual Bills

Support for generating bills and records in multiple languages.

---

# 🤖 AI Assistant

The system can support AI-powered business assistance.

Business-related functionality can work without requiring a separate AI key, depending on the configured application functionality.

For general/world knowledge questions, configure:

```env
GEMINI_API_KEY=your_gemini_api_key
```

An API key can also be configured through the application's:

```text
Settings → AI Assistant
```

Optional environment variable:

```env
GROQ_API_KEY=your_groq_api_key
```

> Configure only the providers actually used by your current application build.

---

# 🛠️ Local Development

## Requirements

Before running the application locally, install:

* Node.js
* npm
* PostgreSQL
* Git

---

## Clone the Repository

```bash
git clone https://github.com/ahsanidreesnns8-ai/Arhat-Management-System.git
```

Enter the project:

```bash
cd Arhat-Management-System
```

---

# ▶️ Run the Next.js Application

Move into the production application:

```bash
cd web
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Configure your PostgreSQL database:

```env
DATABASE_URL=your_postgresql_connection_string
```

If required:

```env
JWT_SECRET=your_random_secret
```

Push the Prisma schema:

```bash
npx prisma db push
```

Seed the database:

```bash
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 🐳 Legacy Stack

The repository also contains a previous architecture based on:

```text
React + Vite
       │
       ▼
Java Spring Boot
       │
       ▼
MySQL
```

It can be started using Docker Compose:

```bash
docker compose up -d --build
```

### Legacy Services

| Service         | URL                         |
| --------------- | --------------------------- |
| React UI        | `http://localhost:5173`     |
| Spring Boot API | `http://localhost:8080/api` |
| MySQL           | `localhost:3306`            |

The legacy architecture is retained for development, reference, and compatibility purposes.

---

# 🔄 Development Workflow

A recommended development workflow is:

```text
Create Feature
      │
      ▼
Create Git Branch
      │
      ▼
Develop & Test
      │
      ▼
Commit Changes
      │
      ▼
Push Branch
      │
      ▼
Pull Request
      │
      ▼
Review
      │
      ▼
Merge into main
      │
      ▼
Vercel Deployment
```

Example:

```bash
git checkout -b feature/new-module
```

After development:

```bash
git add .
git commit -m "Add new module"
git push origin feature/new-module
```

---

# 🔒 Environment Variables

Create:

```text
web/.env
```

Example:

```env
DATABASE_URL=your_postgresql_connection_string

JWT_SECRET=your_long_random_secret

GEMINI_API_KEY=your_gemini_api_key

GROQ_API_KEY=your_groq_api_key
```

### Important

Do **not** commit:

```text
.env
.env.local
.env.production
```

Use:

```text
.env.example
```

for publicly documented variable names.

---

# 🗄️ Database

The production architecture uses:

```text
PostgreSQL
```

with:

```text
Prisma ORM
```

Basic database workflow:

```bash
npx prisma db push
```

Seed data:

```bash
npm run db:seed
```

For inspecting the database:

```bash
npx prisma studio
```

---

# 🌐 Deployment Architecture

```text
                  ┌──────────────────┐
                  │      User        │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │      Vercel      │
                  │                  │
                  │   Next.js 15     │
                  │   TypeScript     │
                  │   API Routes     │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │     Prisma       │
                  │       ORM        │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │   PostgreSQL     │
                  │     Database     │
                  └──────────────────┘
```

---

# ⭐ Key Benefits

* ⚡ Fast modern web interface
* ☁️ Vercel-ready deployment
* 🗄️ PostgreSQL database
* 🔐 Authentication system
* 👥 Staff management
* 👑 Owner administration
* 🌾 Grain trading workflow
* 📦 Inventory management
* 💰 Sales and payments
* 📊 Reporting
* 🔎 Global search
* 🤖 AI assistant
* 🧾 Bilingual billing
* 📱 Responsive interface
* 🧩 Modular architecture
* 🔄 Legacy Java/Spring Boot architecture retained

---

# 🛡️ Security Recommendations

Before deploying the system for a real business:

* Change all seeded/default passwords.
* Generate a strong `JWT_SECRET`.
* Never commit `.env` files.
* Never publish database credentials.
* Never publish API keys.
* Use separate development and production databases.
* Restrict production database access.
* Enable HTTPS through the production hosting platform.
* Review authentication and authorization rules.
* Regularly rotate production secrets.
* Remove test/demo accounts if they are not required.
* Back up production data regularly.

---

# 📌 Production Checklist

Before handing the system to a business:

```text
[ ] PostgreSQL configured
[ ] DATABASE_URL configured
[ ] JWT_SECRET configured
[ ] Production credentials changed
[ ] Demo accounts reviewed
[ ] API keys stored securely
[ ] Database backup configured
[ ] Vercel deployment tested
[ ] Login tested
[ ] Farmer module tested
[ ] Buyer module tested
[ ] Stock tested
[ ] Sales tested
[ ] Payments tested
[ ] Reports tested
[ ] Bills tested
[ ] AI Assistant tested
[ ] Mobile responsiveness tested
[ ] Production URL tested
```

---

# 🏢 Business Use

**Arhat Management System** is designed for businesses involved in:

* Grain trading
* Commission agency operations
* Agricultural trading
* Farmer transactions
* Buyer management
* Grain inventory
* Daily market operations
* Sales and payments
* Business record management

The goal is to provide a centralized digital solution that reduces manual paperwork and makes daily business operations easier to manage.

---

# 👨‍💻 Developer

### Muhammad Ahsan Idrees

**Cybersecurity Student | Full-Stack Developer | Software Developer**

Interested in:

* Cybersecurity
* Full-stack development
* Software engineering
* Database systems
* Backend development
* Business automation
* AI-powered applications

This project represents a practical full-stack business application developed for real-world grain trading and commission agency operations.

---

# 🔗 Connect With Me

### GitHub

**Muhammad Ahsan Idrees**

https://github.com/ahsanidreesnns8-ai

### LinkedIn

**Ahsan Idrees**

https://www.linkedin.com/in/ahsan-idrees-664126329

---

# 📂 Repository

**Arhat Management System**

https://github.com/ahsanidreesnns8-ai/Arhat-Management-System

---

# 📜 Copyright

© 2026 Muhammad Ahsan Idrees. All Rights Reserved.

**Arhat Management System — Rehmani Trading ERP**

Developed for **Rehmani Trading Company**.

This project and its source code are proprietary unless otherwise stated. Unauthorized copying, redistribution, resale, or commercial use of the application or its source code is not permitted without permission from the copyright holder.

---

<div align="center">

### 🌾 Arhat Management System

**Digitizing Grain Trading. Simplifying Business.**

⭐ If you find this project interesting, consider giving the repository a star.

**Built with ❤️, ☕ and modern web technologies.**

</div>
