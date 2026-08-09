package com.rehmani.trading.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ArhatSettlementRequest {
    /**
     * FARMER_PAYABLE — product arrival / amount we owe farmer (creates/prices dheri + posts payable)
     * BUYER_SALE — sell product to buyer (creates sale + receivable, optional cash now)
     */
    @NotBlank
    private String settlementType;

    private Long farmerId;
    private Long buyerId;
    private Long productId;
    /** Optional existing dheri (farmer payable update or farmer-sourced sale) */
    private Long dheriId;

    @NotNull
    private Integer numberOfBags;
    private BigDecimal weightPerBag;
    private BigDecimal partialBagWeight;
    @NotNull
    private BigDecimal marketRate;
    private BigDecimal commissionPercentage;
    /** % of TOTAL amount (defaults: Arhat 3, Munshi 0.70, Workers 0.30) */
    private BigDecimal arhatSharePercentage;
    private BigDecimal munshiNigranSharePercentage;
    private BigDecimal workersSharePercentage;

    /** Cash paid to farmer now / received from buyer now (optional) */
    private BigDecimal paymentNow;
    private String paymentMethod;
    private LocalDate transactionDate;
    private String notes;
}
