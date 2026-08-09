package com.rehmani.trading.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
