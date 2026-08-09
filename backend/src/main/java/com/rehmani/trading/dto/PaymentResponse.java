package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class PaymentResponse {
    private Long id;
    private String paymentType;
    private Long farmerId;
    private String farmerName;
    private String farmerCode;
    private Long buyerId;
    private String buyerName;
    private String buyerCode;
    private Long saleId;
    private String saleInvoiceNumber;
    private Long dheriId;
    private String dheriCode;
    private BigDecimal amount;
    private String paymentMethod;
    private LocalDate paymentDate;
    private String referenceNumber;
    private String notes;
    private String status;
    private LocalDateTime createdAt;
}
