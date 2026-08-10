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
    private final WeatherCalendarService weatherCalendarService;

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
        // Gemini/Groq keys are env-managed (GEMINI_API_KEY / GROQ_API_KEY). Ignore client updates.

        if (request.getWeatherLatitude() != null) settings.setWeatherLatitude(request.getWeatherLatitude());
        if (request.getWeatherLongitude() != null) settings.setWeatherLongitude(request.getWeatherLongitude());
        if (request.getWeatherLocationLabel() != null) settings.setWeatherLocationLabel(request.getWeatherLocationLabel().trim());
        if (request.getWeatherTimezone() != null && !request.getWeatherTimezone().isBlank()) {
            settings.setWeatherTimezone(request.getWeatherTimezone().trim());
        }

        if (Boolean.TRUE.equals(request.getResetHijriAuto())) {
            settings.setHijriAdjustmentDays(0);
        } else if (request.getHijriCorrectDay() != null
                && request.getHijriCorrectMonth() != null
                && request.getHijriCorrectYear() != null) {
            int day = request.getHijriCorrectDay();
            int month = request.getHijriCorrectMonth();
            int year = request.getHijriCorrectYear();
            if (day < 1 || day > 30 || month < 1 || month > 12 || year < 1300 || year > 1600) {
                throw new IllegalArgumentException("Invalid Islamic date. Use day 1–30, month 1–12, year 1300–1600.");
            }
            int adjustment = weatherCalendarService.computeHijriAdjustment(
                    day, month, year, settings.getWeatherTimezone());
            // Keep offset in a practical range for moon-sighting differences
            if (adjustment < -3 || adjustment > 3) {
                throw new IllegalArgumentException("Islamic date correction is more than ±3 days from the calculated date. Check the values.");
            }
            settings.setHijriAdjustmentDays(adjustment);
        } else if (request.getHijriAdjustmentDays() != null) {
            int adj = request.getHijriAdjustmentDays();
            if (adj < -3 || adj > 3) {
                throw new IllegalArgumentException("Hijri adjustment must be between -3 and +3 days.");
            }
            settings.setHijriAdjustmentDays(adj);
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

        BusinessSettingsResponse response = toResponse(settingsRepository.save(settings));
        weatherCalendarService.clearCache();
        return response;
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
                // Never expose AI key status from DB; keys are env-managed
                .geminiApiKeyConfigured(false)
                .weatherLatitude(settings.getWeatherLatitude())
                .weatherLongitude(settings.getWeatherLongitude())
                .weatherLocationLabel(settings.getWeatherLocationLabel())
                .weatherTimezone(settings.getWeatherTimezone())
                .hijriAdjustmentDays(settings.getHijriAdjustmentDays())
                .build();
    }
}
