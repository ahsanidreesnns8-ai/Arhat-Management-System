package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiChatRequest {
    private String message;
}
