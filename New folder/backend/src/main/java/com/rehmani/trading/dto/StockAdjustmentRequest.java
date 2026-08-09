package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class StockAdjustmentRequest {
    @NotNull
    private Long productId;
    @NotNull
    private BigDecimal quantity;
    private String notes;
    private String type; // INCOMING, OUTGOING, ADJUSTMENT, TRANSFER
}
