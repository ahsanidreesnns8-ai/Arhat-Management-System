package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class PriceCalculationRequest {
    private String dheriNumber;
    private String productName;
    private Integer numberOfBags;
    private BigDecimal weightPerBag;
    private BigDecimal partialBagWeight;
    private BigDecimal marketRate;
    private BigDecimal commissionPercentage;
    private BigDecimal arhatSharePercentage;
    private BigDecimal munshiNigranSharePercentage;
    private BigDecimal workersSharePercentage;
}
