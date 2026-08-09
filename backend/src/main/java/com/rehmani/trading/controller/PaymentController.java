package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.PaymentRequest;
import com.rehmani.trading.dto.PaymentResponse;
import com.rehmani.trading.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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

    @GetMapping("/by-date")
    public ApiResponse<List<PaymentResponse>> getByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ApiResponse.ok(paymentService.getByDate(date));
    }

    @GetMapping("/farmer/{farmerId}")
    public ApiResponse<List<PaymentResponse>> getByFarmer(@PathVariable Long farmerId) {
        return ApiResponse.ok(paymentService.getByFarmer(farmerId));
    }

    @GetMapping("/buyer/{buyerId}")
    public ApiResponse<List<PaymentResponse>> getByBuyer(@PathVariable Long buyerId) {
        return ApiResponse.ok(paymentService.getByBuyer(buyerId));
    }

    @GetMapping("/dheri/{dheriId}")
    public ApiResponse<List<PaymentResponse>> getByDheri(
            @PathVariable Long dheriId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        if (date != null) {
            return ApiResponse.ok(paymentService.getByDheriAndDate(dheriId, date));
        }
        return ApiResponse.ok(paymentService.getByDheri(dheriId));
    }

    @GetMapping("/{id}")
    public ApiResponse<PaymentResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(paymentService.getById(id));
    }

    @PostMapping
    public ApiResponse<PaymentResponse> record(@Valid @RequestBody PaymentRequest request) {
        return ApiResponse.ok("Payment recorded", paymentService.record(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<PaymentResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody PaymentRequest request
    ) {
        return ApiResponse.ok("Payment updated and balances settled", paymentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        paymentService.delete(id);
        return ApiResponse.ok("Payment deleted and balances restored", null);
    }
}
