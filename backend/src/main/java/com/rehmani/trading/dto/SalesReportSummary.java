package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class SalesReportSummary {
    private LocalDate from;
    private LocalDate to;
    private int totalSales;
    private BigDecimal totalAmount;
    private BigDecimal totalPaid;
    private BigDecimal totalOutstanding;
    private List<SaleReportLine> lines;
}
