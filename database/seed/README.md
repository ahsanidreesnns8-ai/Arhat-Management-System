# Seed data notes

Flyway `V1__initial_schema.sql` seeds:

- Business settings: Rehmani Trading Company
- Products: Wheat, Paddy, Maize, Barley (40kg default bag)
- Stock rows for each product (qty 0)
- Owner user: `owner` / `admin123` (BCrypt hash in migration)

After the app runs once, create farmers/buyers/dheris/sales from the UI
or insert carefully with foreign keys intact.

Prefer using the app **Daily Trade** and **Farmer Product** screens so calculator math, payables,
receivables, Extra KG stock, and payment rows stay consistent.
