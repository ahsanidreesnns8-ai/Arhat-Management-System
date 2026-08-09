package com.rehmani.trading.service;

import com.rehmani.trading.dto.BusinessSettingsRequest;
import com.rehmani.trading.dto.BusinessSettingsResponse;
import com.rehmani.trading.dto.ProductResponse;
import com.rehmani.trading.entity.BusinessSettings;
import com.rehmani.trading.repository.BusinessSettingsRepository;
import com.rehmani.trading.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final BusinessSettingsRepository settingsRepository;
    private final ProductRepository productRepository;

    public BusinessSettingsResponse getSettings() {
        BusinessSettings settings = settingsRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Settings not found"));
        return toResponse(settings);
    }

    @Transactional
    public BusinessSettingsResponse updateSettings(BusinessSettingsRequest request) {
        BusinessSettings settings = settingsRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Settings not found"));

        if (request.getCompanyName() != null) settings.setCompanyName(request.getCompanyName());
        if (request.getCompanyLogoUrl() != null) settings.setCompanyLogoUrl(request.getCompanyLogoUrl());
        if (request.getAddress() != null) settings.setAddress(request.getAddress());
        if (request.getPhone() != null) settings.setPhone(request.getPhone());
        if (request.getEmail() != null) settings.setEmail(request.getEmail());
        if (request.getDefaultCommissionPercentage() != null) settings.setDefaultCommissionPercentage(request.getDefaultCommissionPercentage());
        if (request.getSupervisorSharePercentage() != null) settings.setSupervisorSharePercentage(request.getSupervisorSharePercentage());
        if (request.getLaborSharePercentage() != null) settings.setLaborSharePercentage(request.getLaborSharePercentage());
        if (request.getArhatSharePercentage() != null) settings.setArhatSharePercentage(request.getArhatSharePercentage());
        if (request.getLowStockThreshold() != null) settings.setLowStockThreshold(request.getLowStockThreshold());
        if (request.getBackupReminderDays() != null) settings.setBackupReminderDays(request.getBackupReminderDays());
        if (request.getPaymentReminderDays() != null) settings.setPaymentReminderDays(request.getPaymentReminderDays());
        if (request.getGeminiApiKey() != null) {
            String key = request.getGeminiApiKey().trim();
            // Empty string clears the key; ignore masked placeholder submissions
            if (key.isEmpty()) {
                settings.setGeminiApiKey(null);
            } else if (!key.contains("•") && !key.equalsIgnoreCase("configured")) {
                settings.setGeminiApiKey(key);
            }
        }

        // Keep total commission in sync with share-of-total model
        if (settings.getArhatSharePercentage() != null
                && settings.getSupervisorSharePercentage() != null
                && settings.getLaborSharePercentage() != null) {
            settings.setDefaultCommissionPercentage(
                    settings.getArhatSharePercentage()
                            .add(settings.getSupervisorSharePercentage())
                            .add(settings.getLaborSharePercentage()));
        }

        return toResponse(settingsRepository.save(settings));
    }

    public List<ProductResponse> getProducts() {
        return productRepository.findByDeletedFalseAndActiveTrueOrderByNameAsc()
                .stream()
                .map(p -> ProductResponse.builder()
                        .id(p.getId())
                        .productCode(p.getProductCode())
                        .name(p.getName())
                        .unit(p.getUnit())
                        .defaultBagWeight(p.getDefaultBagWeight())
                        .build())
                .toList();
    }

    private BusinessSettingsResponse toResponse(BusinessSettings settings) {
        return BusinessSettingsResponse.builder()
                .id(settings.getId())
                .companyName(settings.getCompanyName())
                .companyLogoUrl(settings.getCompanyLogoUrl())
                .address(settings.getAddress())
                .phone(settings.getPhone())
                .email(settings.getEmail())
                .defaultCommissionPercentage(settings.getDefaultCommissionPercentage())
                .supervisorSharePercentage(settings.getSupervisorSharePercentage())
                .laborSharePercentage(settings.getLaborSharePercentage())
                .arhatSharePercentage(settings.getArhatSharePercentage())
                .lowStockThreshold(settings.getLowStockThreshold())
                .backupReminderDays(settings.getBackupReminderDays())
                .paymentReminderDays(settings.getPaymentReminderDays())
                .geminiApiKeyConfigured(settings.getGeminiApiKey() != null && !settings.getGeminiApiKey().isBlank())
                .build();
    }
}
