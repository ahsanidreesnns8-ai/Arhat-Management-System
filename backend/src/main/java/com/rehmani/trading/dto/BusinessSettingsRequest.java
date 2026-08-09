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
}
