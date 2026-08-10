package com.rehmani.trading.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;

/**
 * Ensures critical columns exist when a local DB was created before newer migrations.
 * Dev H2 disables Flyway; Hibernate update can miss some columns — this repairs them safely.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SchemaRepair {

    private final JdbcTemplate jdbcTemplate;
    private final Environment environment;

    @PostConstruct
    public void repair() {
        ensureColumn("dheris", "payable_posted", "BOOLEAN NOT NULL DEFAULT FALSE");
        ensureColumn("business_settings", "weather_latitude", "DECIMAL(10,6) NOT NULL DEFAULT 31.520400");
        ensureColumn("business_settings", "weather_longitude", "DECIMAL(10,6) NOT NULL DEFAULT 74.358700");
        ensureColumn("business_settings", "weather_location_label", "VARCHAR(120) NOT NULL DEFAULT 'Lahore'");
        ensureColumn("business_settings", "weather_timezone", "VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi'");
        ensureColumn("business_settings", "hijri_adjustment_days", "INT NOT NULL DEFAULT 0");
        ensureColumn("payments", "dheri_id", "BIGINT NULL");
        ensureSyncState();
    }

    private boolean isH2() {
        String url = environment.getProperty("spring.datasource.url", "").toLowerCase(Locale.ROOT);
        return url.contains("jdbc:h2:") || Arrays.asList(environment.getActiveProfiles()).contains("dev");
    }

    private void ensureColumn(String table, String column, String definition) {
        try {
            if (isH2()) {
                jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS " + column + " " + definition);
            } else {
                Integer exists = jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*) FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
                        """,
                        Integer.class, table, column);
                if (exists == null || exists == 0) {
                    jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
                }
            }
            log.info("Schema repair ensured {}.{}", table, column);
        } catch (Exception ex) {
            log.debug("Schema repair skip {}.{}: {}", table, column, ex.getMessage());
        }
    }

    private void ensureSyncState() {
        try {
            if (isH2()) {
                jdbcTemplate.execute("""
                        CREATE TABLE IF NOT EXISTS sync_state (
                            id BIGINT PRIMARY KEY,
                            revision BIGINT NOT NULL DEFAULT 1,
                            updated_at TIMESTAMP
                        )
                        """);
                jdbcTemplate.update("MERGE INTO sync_state (id, revision) KEY(id) VALUES (1, 1)");
            } else {
                jdbcTemplate.execute("""
                        CREATE TABLE IF NOT EXISTS sync_state (
                            id BIGINT PRIMARY KEY,
                            revision BIGINT NOT NULL DEFAULT 1,
                            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        )
                        """);
                jdbcTemplate.update("""
                        INSERT INTO sync_state (id, revision)
                        SELECT 1, 1 FROM DUAL
                        WHERE NOT EXISTS (SELECT 1 FROM sync_state WHERE id = 1)
                        """);
            }
        } catch (Exception ex) {
            log.debug("sync_state ensure skipped: {}", ex.getMessage());
        }
    }
}
