package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class LedgerEntryDto {
    private LocalDate date;
    private String entryType;
    private String description;
    private BigDecimal amount;
    private Long referenceId;
    private String referenceType;
}
