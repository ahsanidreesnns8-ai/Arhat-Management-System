package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class QueueEntryResponse {
    private Long id;
    private Integer queueNumber;
    private Long dheriId;
    private String dheriCode;
    private String farmerName;
    private String productName;
    private String status;
    private Integer position;
    private Integer numberOfBags;
}
