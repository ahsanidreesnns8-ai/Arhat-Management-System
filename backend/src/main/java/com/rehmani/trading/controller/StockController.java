package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.StockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/stock")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;

    @GetMapping
    public ApiResponse<List<StockResponse>> getAll() {
        return ApiResponse.ok(stockService.getAll());
    }

    @GetMapping("/history")
    public ApiResponse<List<StockTransactionResponse>> getHistory() {
        return ApiResponse.ok(stockService.getHistory());
    }

    @PostMapping("/adjust")
    public ApiResponse<StockResponse> adjust(@Valid @RequestBody StockAdjustmentRequest request) {
        return ApiResponse.ok("Stock updated", stockService.adjust(request));
    }
}
