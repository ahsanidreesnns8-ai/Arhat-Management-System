package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class ArhatSettlementResponse {
    private String settlementType;
    private Long dheriId;
    private String dheriCode;
    private Long saleId;
    private String invoiceNumber;
    private Long farmerId;
    private Long buyerId;
    private BigDecimal totalAmount;
    private BigDecimal commission;
    private BigDecimal farmerPayable;
    private BigDecimal buyerReceivable;
    private BigDecimal paymentNow;
    private BigDecimal partyOutstandingAfter;
    private PriceCalculationResult calculation;
    private String message;
}
