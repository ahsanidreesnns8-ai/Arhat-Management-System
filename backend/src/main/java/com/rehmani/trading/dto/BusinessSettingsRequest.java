package com.rehmani.trading.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class BusinessSettingsRequest {
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
    private String geminiApiKey;
    private BigDecimal weatherLatitude;
    private BigDecimal weatherLongitude;
    private String weatherLocationLabel;
    private String weatherTimezone;
    private Integer hijriAdjustmentDays;
    /** When set together, server computes hijriAdjustmentDays from today's correct Hijri date. */
    private Integer hijriCorrectDay;
    private Integer hijriCorrectMonth;
    private Integer hijriCorrectYear;
    /** If true, clears manual Hijri offset (auto daily again). */
    private Boolean resetHijriAuto;
}
