# Seed data notes

Flyway `V1__initial_schema.sql` seeds:

- Business settings: Rehmani Trading Company
- Products: Wheat, Rice, Maize, Barley (40kg default bag)
- Stock rows for each product (qty 0)
- Owner user: `owner` / `admin123` (BCrypt hash in migration)

After the app runs once, create farmers/buyers/dheris/sales from the UI
or insert carefully with foreign keys intact.

Prefer using the app **Arhat Sale** screen so calculator math, payables,
receivables, and payment rows stay consistent.
