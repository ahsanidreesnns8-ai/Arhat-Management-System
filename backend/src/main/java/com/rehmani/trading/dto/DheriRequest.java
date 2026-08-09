package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DheriRequest {
    @NotNull
    private Long farmerId;
    private Long truckId;
    @NotNull
    private Long productId;
    private Integer numberOfBags;
    private BigDecimal weightPerBag;
    private BigDecimal partialBagWeight;
    private BigDecimal marketRate;
    private String notes;
}
