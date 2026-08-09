package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class EntityLedgerResponse {
    private BigDecimal balance;
    private List<LedgerEntryDto> entries;
    private List<PaymentResponse> payments;
    private List<DheriResponse> dheris;
    private List<SaleResponse> sales;
    private List<TruckResponse> trucks;
}
