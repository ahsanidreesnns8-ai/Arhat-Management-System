package com.rehmani.trading.config;

import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;

@Configuration
@Profile("dev")
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UserRepository userRepository;
    private final BusinessSettingsRepository settingsRepository;
    private final ProductRepository productRepository;
    private final StockRepository stockRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    CommandLineRunner seedDevData() {
        return args -> {
            if (userRepository.count() == 0) {
                log.info("Seeding dev owner and staff users");
                userRepository.save(User.builder()
                        .username("owner")
                        .email("owner@rehmanitrading.com")
                        .password(passwordEncoder.encode("owner123"))
                        .fullName("System Owner")
                        .role(UserRole.OWNER)
                        .build());
                userRepository.save(User.builder()
                        .username("staff")
                        .email("staff@rehmanitrading.com")
                        .password(passwordEncoder.encode("staff123"))
                        .fullName("Staff")
                        .role(UserRole.OPERATOR)
                        .build());
            }

            if (settingsRepository.count() == 0) {
                log.info("Seeding dev business settings");
                settingsRepository.save(BusinessSettings.builder()
                        .companyName("Rehmani Trading Company")
                        .companyLogoUrl("/rehmani-logo.svg")
                        .address("Main Market, Grain Trading Hub")
                        .phone("+92-300-0000000")
                        .email("info@rehmanitrading.com")
                        .defaultCommissionPercentage(new BigDecimal("4.00"))
                        .arhatSharePercentage(new BigDecimal("3.00"))
                        .supervisorSharePercentage(new BigDecimal("0.70"))
                        .laborSharePercentage(new BigDecimal("0.30"))
                        .build());
            } else {
                settingsRepository.findAll().forEach(s -> {
                    if (s.getCompanyLogoUrl() == null || s.getCompanyLogoUrl().isBlank()) {
                        s.setCompanyLogoUrl("/rehmani-logo.svg");
                        settingsRepository.save(s);
                        log.info("Set default company logo URL on business settings");
                    }
                });
            }

            if (productRepository.count() == 0) {
                log.info("Seeding dev products");
                String[][] products = {
                        {"WHT-001", "Wheat"},
                        {"RCE-001", "Rice"},
                        {"MAZ-001", "Maize"},
                        {"BAR-001", "Barley"}
                };
                for (String[] p : products) {
                    Product product = productRepository.save(Product.builder()
                            .productCode(p[0])
                            .name(p[1])
                            .defaultBagWeight(new BigDecimal("40.00"))
                            .build());
                    stockRepository.save(Stock.builder()
                            .product(product)
                            .quantity(BigDecimal.ZERO)
                            .build());
                }
            }
        };
    }
}
