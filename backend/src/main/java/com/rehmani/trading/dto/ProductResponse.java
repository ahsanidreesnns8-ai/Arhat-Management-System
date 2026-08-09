package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProductResponse {
    private Long id;
    private String productCode;
    private String name;
    private String unit;
    private java.math.BigDecimal defaultBagWeight;
}
