# Rehmani Trading — Database Pack

This folder contains everything you need to inspect and verify money, dheris, sales, and payments in **MySQL Workbench**.

## Contents

| Path | Purpose |
|------|---------|
| `migrations/` | Flyway SQL files used by the Spring Boot app (source of truth) |
| `schema/01_create_database.sql` | Create DB + quick setup notes |
| `queries/` | Ready-to-run Workbench queries for balances and day-wise records |
| `seed/` | Notes about default seed data |

## Connect in MySQL Workbench

1. Open MySQL Workbench
2. Connect to your local server (default Docker Compose credentials):
   - Host: `localhost`
   - Port: `3306`
   - Username: `root`
   - Password: `root`
3. Select schema: `rehmani_trading`

If the database does not exist yet:

```sql
SOURCE database/schema/01_create_database.sql;
```

Then start the backend once so Flyway applies `migrations/V1` … `V5` automatically:

```bash
cd backend
mvn spring-boot:run
```

## Recommended queries (run in order)

1. `queries/01_overview_balances.sql` — company totals (farmer payable, buyer receivable, sales, payments)
2. `queries/02_farmer_payables.sql` — each farmer: billed / paid / remaining + product/dheri detail
3. `queries/03_buyer_receivables.sql` — each buyer: billed / paid / remaining + invoices
4. `queries/04_dheri_payments_by_day.sql` — one dheri or all dheris, payments with dates
5. `queries/05_sales_and_commissions.sql` — sales lines, commission shares
6. `queries/06_stock.sql` — current stock and movements
7. `queries/07_day_cashbook.sql` — all money in/out on a selected date

Replace date placeholders like `'2026-08-09'` with the day you want.

## Default login (app)

- Username: `owner`
- Password: `admin123`
