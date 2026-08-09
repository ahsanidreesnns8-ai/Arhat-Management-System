package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TruckRequest {
    @NotBlank
    private String registrationNumber;
    private String driverName;
    private String driverPhone;
    @NotNull
    private Long farmerId;
    private BigDecimal capacity;
    private String notes;
}
