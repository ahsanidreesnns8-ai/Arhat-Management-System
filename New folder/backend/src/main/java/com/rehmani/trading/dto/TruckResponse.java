package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class TruckResponse {
    private Long id;
    private String truckId;
    private String registrationNumber;
    private String driverName;
    private String driverPhone;
    private Long farmerId;
    private String farmerName;
    private String farmerCode;
    private BigDecimal capacity;
    private String notes;
    private Boolean active;
}
