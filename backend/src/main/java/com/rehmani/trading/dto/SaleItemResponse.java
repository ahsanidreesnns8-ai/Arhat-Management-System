package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class SaleItemResponse {
    private Long id;
    private Long productId;
    private String productName;
    private String sourceType;
    private Long farmerId;
    private String farmerName;
    private Long dheriId;
    private String dheriCode;
    private Integer numberOfBags;
    private BigDecimal weightPerBag;
    private BigDecimal partialBagWeight;
    private BigDecimal totalWeight;
    private BigDecimal rate;
    private BigDecimal amount;
}
