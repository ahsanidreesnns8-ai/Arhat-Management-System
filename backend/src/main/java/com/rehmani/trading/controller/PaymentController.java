package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.PaymentRequest;
import com.rehmani.trading.dto.PaymentResponse;
import com.rehmani.trading.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping
    public ApiResponse<List<PaymentResponse>> getAll() {
        return ApiResponse.ok(paymentService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<PaymentResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(paymentService.getById(id));
    }

    @GetMapping("/farmer/{farmerId}")
    public ApiResponse<List<PaymentResponse>> getByFarmer(@PathVariable Long farmerId) {
        return ApiResponse.ok(paymentService.getByFarmer(farmerId));
    }

    @GetMapping("/buyer/{buyerId}")
    public ApiResponse<List<PaymentResponse>> getByBuyer(@PathVariable Long buyerId) {
        return ApiResponse.ok(paymentService.getByBuyer(buyerId));
    }

    @PostMapping
    public ApiResponse<PaymentResponse> record(@Valid @RequestBody PaymentRequest request) {
        return ApiResponse.ok("Payment recorded", paymentService.record(request));
    }
}
