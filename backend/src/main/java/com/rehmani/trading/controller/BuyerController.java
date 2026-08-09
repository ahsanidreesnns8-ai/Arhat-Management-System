package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.BuyerService;
import com.rehmani.trading.service.PaymentService;
import com.rehmani.trading.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/buyers")
@RequiredArgsConstructor
public class BuyerController {

    private final BuyerService buyerService;
    private final PaymentService paymentService;
    private final SaleService saleService;

    @GetMapping
    public ApiResponse<List<BuyerResponse>> getAll() {
        return ApiResponse.ok(buyerService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<BuyerResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(buyerService.getById(id));
    }

    @GetMapping("/{id}/payments")
    public ApiResponse<List<PaymentResponse>> getPayments(@PathVariable Long id) {
        buyerService.getById(id);
        return ApiResponse.ok(paymentService.getByBuyer(id));
    }

    @GetMapping("/{id}/sales")
    public ApiResponse<List<SaleResponse>> getSales(@PathVariable Long id) {
        return ApiResponse.ok(saleService.getByBuyer(id));
    }

    @GetMapping("/{id}/ledger")
    public ApiResponse<EntityLedgerResponse> getLedger(@PathVariable Long id) {
        return ApiResponse.ok(buyerService.getLedger(id));
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
