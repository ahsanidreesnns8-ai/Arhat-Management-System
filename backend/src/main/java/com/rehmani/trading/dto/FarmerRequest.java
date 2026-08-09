package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class FarmerRequest {
    @NotBlank
    private String name;
    private String cnic;
    private String phone;
    private String address;
    private String city;
    private String notes;
}
