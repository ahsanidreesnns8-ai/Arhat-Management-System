package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.ArhatSettlementRequest;
import com.rehmani.trading.dto.ArhatSettlementResponse;
import com.rehmani.trading.service.ArhatSettlementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/arhat")
@RequiredArgsConstructor
public class ArhatSettlementController {

    private final ArhatSettlementService arhatSettlementService;

    @PostMapping("/settle")
    public ApiResponse<ArhatSettlementResponse> settle(@Valid @RequestBody ArhatSettlementRequest request) {
        ArhatSettlementResponse result = arhatSettlementService.settle(request);
        return ApiResponse.ok(result.getMessage(), result);
    }
}
