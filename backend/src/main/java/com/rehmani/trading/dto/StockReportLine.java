package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class StockReportLine {
    private Long productId;
    private String productCode;
    private String productName;
    private BigDecimal quantity;
    private Boolean lowStockAlert;
}
