package com.rehmani.trading.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatRequest {
    private String message;
    /** Preferred reply language: "en" or "ur" */
    private String language;
    /** Prior turns for conversational context (optional) */
    private List<AiChatMessage> history;
}
