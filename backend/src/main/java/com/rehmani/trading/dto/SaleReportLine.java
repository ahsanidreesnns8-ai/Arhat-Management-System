package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class SaleReportLine {
    private Long saleId;
    private String invoiceNumber;
    private LocalDate saleDate;
    private String buyerName;
    private Integer totalBags;
    private BigDecimal totalWeight;
    private BigDecimal totalAmount;
    private BigDecimal paidAmount;
}
