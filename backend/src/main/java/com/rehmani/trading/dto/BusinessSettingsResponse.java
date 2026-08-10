package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BusinessSettingsResponse {
    private Long id;
    private String companyName;
    private String companyLogoUrl;
    private String address;
    private String phone;
    private String email;
    private BigDecimal defaultCommissionPercentage;
    private BigDecimal supervisorSharePercentage;
    private BigDecimal laborSharePercentage;
    private BigDecimal arhatSharePercentage;
    private BigDecimal lowStockThreshold;
    private Integer backupReminderDays;
    private Integer paymentReminderDays;
    /** Masked indicator — never returns the raw key. */
    private Boolean geminiApiKeyConfigured;
    private BigDecimal weatherLatitude;
    private BigDecimal weatherLongitude;
    private String weatherLocationLabel;
    private String weatherTimezone;
    private Integer hijriAdjustmentDays;
}
