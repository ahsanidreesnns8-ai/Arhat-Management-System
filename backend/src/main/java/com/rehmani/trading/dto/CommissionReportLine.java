package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class CommissionReportLine {
    private Long dheriId;
    private String dheriNumber;
    private String farmerName;
    private BigDecimal totalPrice;
    private BigDecimal commissionAmount;
    private BigDecimal arhatShare;
    private BigDecimal supervisorShare;
    private BigDecimal laborShare;
}
