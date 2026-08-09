package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class StockReportSummary {
    private BigDecimal totalQuantity;
    private int lowStockCount;
    private List<StockReportLine> lines;
}
