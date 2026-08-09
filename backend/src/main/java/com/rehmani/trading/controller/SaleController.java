package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.SaleRequest;
import com.rehmani.trading.dto.SaleResponse;
import com.rehmani.trading.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    @GetMapping
    public ApiResponse<List<SaleResponse>> getAll() {
        return ApiResponse.ok(saleService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<SaleResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(saleService.getById(id));
    }

    @GetMapping("/buyer/{buyerId}")
    public ApiResponse<List<SaleResponse>> getByBuyer(@PathVariable Long buyerId) {
        return ApiResponse.ok(saleService.getByBuyer(buyerId));
    }

    @PostMapping
    public ApiResponse<SaleResponse> create(@Valid @RequestBody SaleRequest request) {
        return ApiResponse.ok("Sale created", saleService.create(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        saleService.delete(id);
        return ApiResponse.ok("Sale deleted", null);
    }
}
