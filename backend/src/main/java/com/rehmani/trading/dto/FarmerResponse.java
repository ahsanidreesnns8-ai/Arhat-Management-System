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
    private String notes;
    private Boolean active;
}
