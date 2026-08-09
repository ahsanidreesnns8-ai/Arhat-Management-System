-- Rehmani Trading Company ERP
-- Run this once in MySQL Workbench, then start the Spring Boot backend
-- so Flyway applies database/migrations (or backend/src/main/resources/db/migration).

CREATE DATABASE IF NOT EXISTS rehmani_trading
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE rehmani_trading;

-- Optional: confirm empty / existing tables
SHOW TABLES;
