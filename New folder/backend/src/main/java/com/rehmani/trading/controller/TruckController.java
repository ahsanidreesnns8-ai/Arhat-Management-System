package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.TruckService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/trucks")
@RequiredArgsConstructor
public class TruckController {

    private final TruckService truckService;

    @GetMapping
    public ApiResponse<List<TruckResponse>> getAll() {
        return ApiResponse.ok(truckService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<TruckResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(truckService.getById(id));
    }

    @PostMapping
    public ApiResponse<TruckResponse> create(@Valid @RequestBody TruckRequest request) {
        return ApiResponse.ok("Truck created", truckService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TruckResponse> update(@PathVariable Long id, @Valid @RequestBody TruckRequest request) {
        return ApiResponse.ok("Truck updated", truckService.update(id, request));
    }
}
