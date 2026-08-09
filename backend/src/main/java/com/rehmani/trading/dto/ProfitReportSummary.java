package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class ProfitReportSummary {
    private LocalDate from;
    private LocalDate to;
    private BigDecimal totalSales;
    private BigDecimal totalCommission;
    private BigDecimal estimatedProfit;
}
