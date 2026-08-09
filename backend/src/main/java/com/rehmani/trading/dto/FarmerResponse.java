package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class FarmerResponse {
    private Long id;
    private String farmerId;
    private String name;
    private String cnic;
    private String phone;
    private String address;
    private String city;
    private BigDecimal outstandingBalance;
    /** Sum of farmer receivables from dheris / sales */
    private BigDecimal totalBilled;
    /** Sum of payments made to the farmer */
    private BigDecimal totalPaid;
    private String notes;
    private Boolean active;
}
