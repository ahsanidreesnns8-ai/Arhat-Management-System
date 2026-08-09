package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class DheriResponse {
    private Long id;
    private String dheriId;
    private Long farmerId;
    private String farmerName;
    private String farmerCode;
    private Long truckId;
    private String truckCode;
    private Long productId;
    private String productName;
    private Integer queueNumber;
    private Integer numberOfBags;
    private BigDecimal weightPerBag;
    private BigDecimal partialBagWeight;
    private BigDecimal totalWeight;
    private BigDecimal marketRate;
    private BigDecimal commissionPercentage;
    private BigDecimal totalPrice;
    private BigDecimal commissionAmount;
    private BigDecimal farmerReceivable;
    private BigDecimal supervisorShare;
    private BigDecimal laborShare;
    private BigDecimal arhatShare;
    private String sellingStatus;
    private Boolean payablePosted;
    private String notes;
}
