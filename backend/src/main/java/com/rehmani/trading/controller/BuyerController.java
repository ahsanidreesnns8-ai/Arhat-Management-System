package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.BuyerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/buyers")
@RequiredArgsConstructor
public class BuyerController {

    private final BuyerService buyerService;

    @GetMapping
    public ApiResponse<List<BuyerResponse>> getAll() {
        return ApiResponse.ok(buyerService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<BuyerResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(buyerService.getById(id));
    }

    @PostMapping
    public ApiResponse<BuyerResponse> create(@Valid @RequestBody BuyerRequest request) {
        return ApiResponse.ok("Buyer created", buyerService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<BuyerResponse> update(@PathVariable Long id, @Valid @RequestBody BuyerRequest request) {
        return ApiResponse.ok("Buyer updated", buyerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        buyerService.delete(id);
        return ApiResponse.ok("Buyer deleted", null);
    }
}
