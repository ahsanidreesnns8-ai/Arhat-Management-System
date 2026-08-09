package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class RecentActivityDto {
    private String action;
    private String entityType;
    private String description;
    private LocalDateTime timestamp;
}
