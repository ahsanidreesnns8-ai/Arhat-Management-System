package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SyncPulseResponse {
    private Long revision;
    private String serverTime;
    private String updatedAt;
}
