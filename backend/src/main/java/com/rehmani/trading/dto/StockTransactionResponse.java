package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class StockTransactionResponse {
    private Long id;
    private Long productId;
    private String productName;
    private String transactionType;
    private BigDecimal quantity;
    private BigDecimal previousQuantity;
    private BigDecimal newQuantity;
    private String notes;
    private LocalDateTime createdAt;
}
