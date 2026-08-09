package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.DheriResponse;
import com.rehmani.trading.dto.PriceCalculationRequest;
import com.rehmani.trading.dto.PriceCalculationResult;
import com.rehmani.trading.service.DheriService;
import com.rehmani.trading.service.PriceCalculatorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/calculator")
@RequiredArgsConstructor
public class PriceCalculatorController {

    private final PriceCalculatorService calculatorService;
    private final DheriService dheriService;

    @PostMapping("/calculate")
    public ApiResponse<PriceCalculationResult> calculate(@RequestBody PriceCalculationRequest request) {
        return ApiResponse.ok(calculatorService.calculate(request));
    }

    @PostMapping("/save/{dheriId}")
    public ApiResponse<DheriResponse> saveToDheri(
            @PathVariable Long dheriId,
            @RequestBody PriceCalculationRequest request) {
        calculatorService.saveToDheri(dheriId, request);
        return ApiResponse.ok("Calculation saved to dheri record", dheriService.getById(dheriId));
    }
}
