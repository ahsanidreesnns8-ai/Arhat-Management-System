package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class SaleResponse {
    private Long id;
    private String invoiceNumber;
    private Long buyerId;
    private String buyerName;
    private String buyerCode;
    private LocalDate saleDate;
    private Integer totalBags;
    private BigDecimal totalWeight;
    private BigDecimal totalAmount;
    private BigDecimal paidAmount;
    private String paymentStatus;
    private String notes;
    private LocalDateTime createdAt;
    private List<SaleItemResponse> items;
}
