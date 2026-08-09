package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class PriceCalculationResult {
    private BigDecimal totalWeight;
    private Integer totalUnitsWhole;
    private BigDecimal remainderKg;
    private BigDecimal totalMann;
    private BigDecimal totalAmount;
    private BigDecimal commissionPercentage;
    private BigDecimal commission;
    private BigDecimal farmerFinalBalance;
    private BigDecimal arhatShare;
    private BigDecimal munshiNigranShare;
    private BigDecimal workersShare;
    private BigDecimal arhatSharePercentage;
    private BigDecimal munshiNigranSharePercentage;
    private BigDecimal workersSharePercentage;
}
