package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SaleItemRequest {
    @NotNull
    private Long productId;
    @NotNull
    private String sourceType;
    private Long farmerId;
    private Long dheriId;
    private Integer numberOfBags;
    private BigDecimal weightPerBag;
    private BigDecimal partialBagWeight;
    @NotNull
    private BigDecimal rate;
}
