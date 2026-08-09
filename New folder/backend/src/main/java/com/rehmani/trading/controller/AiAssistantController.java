package com.rehmani.trading.controller;

import com.rehmani.trading.dto.AiChatRequest;
import com.rehmani.trading.dto.AiChatResponse;
import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.service.AiAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiAssistantController {

    private final AiAssistantService aiAssistantService;

    @PostMapping("/chat")
    public ApiResponse<AiChatResponse> chat(@RequestBody AiChatRequest request) {
        return ApiResponse.ok(aiAssistantService.chat(request));
    }
}
