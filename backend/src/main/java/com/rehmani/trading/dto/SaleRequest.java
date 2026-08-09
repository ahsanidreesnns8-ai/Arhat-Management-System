package com.rehmani.trading.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class SaleRequest {
    @NotNull
    private Long buyerId;
    private LocalDate saleDate;
    private String notes;
    private BigDecimal paidAmount;
    @NotEmpty
    @Valid
    private List<SaleItemRequest> items;
}
