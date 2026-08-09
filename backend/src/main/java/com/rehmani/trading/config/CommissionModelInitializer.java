package com.rehmani.trading.config;

import com.rehmani.trading.entity.BusinessSettings;
import com.rehmani.trading.repository.BusinessSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.math.BigDecimal;

/**
 * Ensures commission shares are % of total amount: Arhat 3%, Munshi 0.70%, Workers 0.30%.
 * Migrates older "share of commission pool" settings (e.g. 30/40/30).
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class CommissionModelInitializer {

    private final BusinessSettingsRepository settingsRepository;

    @Bean
    @Order(50)
    CommandLineRunner migrateCommissionModel() {
        return args -> settingsRepository.findAll().forEach(this::normalize);
    }

    private void normalize(BusinessSettings s) {
        BigDecimal arhat = s.getArhatSharePercentage() != null ? s.getArhatSharePercentage() : BigDecimal.ZERO;
        // Old model stored 30/40/30 as % of commission pool
        boolean looksLikeOldPoolShares = arhat.compareTo(new BigDecimal("10")) >= 0;
        if (!looksLikeOldPoolShares) {
            return;
        }
        log.info("Migrating commission settings to % of total: Arhat 3%, Munshi 0.70%, Workers 0.30%");
        s.setArhatSharePercentage(new BigDecimal("3.00"));
        s.setSupervisorSharePercentage(new BigDecimal("0.70"));
        s.setLaborSharePercentage(new BigDecimal("0.30"));
        s.setDefaultCommissionPercentage(new BigDecimal("4.00"));
        settingsRepository.save(s);
    }
}
