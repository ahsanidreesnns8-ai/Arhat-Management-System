package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class CommissionReportSummary {
    private LocalDate from;
    private LocalDate to;
    private BigDecimal totalCommission;
    private BigDecimal totalArhatShare;
    private BigDecimal totalSupervisorShare;
    private BigDecimal totalLaborShare;
    private List<CommissionReportLine> lines;
}
