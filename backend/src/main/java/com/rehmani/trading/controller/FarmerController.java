package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.DheriService;
import com.rehmani.trading.service.FarmerService;
import com.rehmani.trading.service.PaymentService;
import com.rehmani.trading.service.TruckService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/farmers")
@RequiredArgsConstructor
public class FarmerController {

    private final FarmerService farmerService;
    private final PaymentService paymentService;
    private final DheriService dheriService;
    private final TruckService truckService;

    @GetMapping
    public ApiResponse<List<FarmerResponse>> getAll() {
        return ApiResponse.ok(farmerService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmerResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(farmerService.getById(id));
    }

    @GetMapping("/{id}/payments")
    public ApiResponse<List<PaymentResponse>> getPayments(@PathVariable Long id) {
        farmerService.getById(id);
        return ApiResponse.ok(paymentService.getByFarmer(id));
    }

    @GetMapping("/{id}/dheris")
    public ApiResponse<List<DheriResponse>> getDheris(@PathVariable Long id) {
        return ApiResponse.ok(dheriService.getByFarmer(id));
    }

    @GetMapping("/{id}/trucks")
    public ApiResponse<List<TruckResponse>> getTrucks(@PathVariable Long id) {
        return ApiResponse.ok(truckService.getByFarmer(id));
    }

    @GetMapping("/{id}/ledger")
    public ApiResponse<EntityLedgerResponse> getLedger(@PathVariable Long id) {
        return ApiResponse.ok(farmerService.getLedger(id));
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
