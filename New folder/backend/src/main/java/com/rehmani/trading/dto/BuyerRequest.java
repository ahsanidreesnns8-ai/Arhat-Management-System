package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BuyerRequest {
    @NotBlank
    private String name;
    private String cnic;
    private String phone;
    private String address;
    private String city;
    private String notes;
}
