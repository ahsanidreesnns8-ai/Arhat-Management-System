package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PaymentRequest {
    @NotNull
    private String paymentType;
    private Long farmerId;
    private Long buyerId;
    private Long saleId;
    private Long dheriId;
    @NotNull
    private BigDecimal amount;
    private String paymentMethod;
    private LocalDate paymentDate;
    private String referenceNumber;
    private String notes;
}
