package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.FarmerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/farmers")
@RequiredArgsConstructor
public class FarmerController {

    private final FarmerService farmerService;

    @GetMapping
    public ApiResponse<List<FarmerResponse>> getAll() {
        return ApiResponse.ok(farmerService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmerResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(farmerService.getById(id));
    }

    @PostMapping
    public ApiResponse<FarmerResponse> create(@Valid @RequestBody FarmerRequest request) {
        return ApiResponse.ok("Farmer created", farmerService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<FarmerResponse> update(@PathVariable Long id, @Valid @RequestBody FarmerRequest request) {
        return ApiResponse.ok("Farmer updated", farmerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        farmerService.delete(id);
        return ApiResponse.ok("Farmer deleted", null);
    }
}
