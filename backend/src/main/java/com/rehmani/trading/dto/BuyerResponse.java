package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BuyerResponse {
    private Long id;
    private String buyerId;
    private String name;
    private String cnic;
    private String phone;
    private String address;
    private String city;
    private BigDecimal outstandingBalance;
    /** Sum of all sale totals */
    private BigDecimal totalBilled;
    /** Sum of recorded payments */
    private BigDecimal totalPaid;
    private String notes;
    private Boolean active;
}
