package com.rehmani.trading.service;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ArhatSettlementService {

    private final PriceCalculatorService priceCalculatorService;
    private final DheriService dheriService;
    private final DheriRepository dheriRepository;
    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final SaleService saleService;
    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;

    @Transactional
    public ArhatSettlementResponse settle(ArhatSettlementRequest request) {
        String type = request.getSettlementType() == null ? "" : request.getSettlementType().trim().toUpperCase();
        return switch (type) {
            case "FARMER_PAYABLE" -> settleFarmerPayable(request);
            case "BUYER_SALE" -> settleBuyerSale(request);
            default -> throw new RuntimeException("settlementType must be FARMER_PAYABLE or BUYER_SALE");
        };
    }

    private ArhatSettlementResponse settleFarmerPayable(ArhatSettlementRequest request) {
        if (request.getFarmerId() == null) throw new RuntimeException("Farmer is required");
        if (request.getProductId() == null && request.getDheriId() == null) {
            throw new RuntimeException("Product or existing dheri is required");
        }

        PriceCalculationRequest calcReq = toCalcRequest(request);
        PriceCalculationResult calc = priceCalculatorService.calculate(calcReq);

        Dheri dheri;
        if (request.getDheriId() != null) {
            dheri = priceCalculatorService.saveToDheri(request.getDheriId(), calcReq);
        } else {
            DheriRequest dheriRequest = new DheriRequest();
            dheriRequest.setFarmerId(request.getFarmerId());
            dheriRequest.setProductId(request.getProductId());
            dheriRequest.setNumberOfBags(request.getNumberOfBags());
            dheriRequest.setWeightPerBag(defaultBd(request.getWeightPerBag(), new BigDecimal("40")));
            dheriRequest.setPartialBagWeight(defaultBd(request.getPartialBagWeight(), BigDecimal.ZERO));
            dheriRequest.setMarketRate(request.getMarketRate());
            dheriRequest.setNotes(request.getNotes());
            DheriResponse created = dheriService.create(dheriRequest);
            // Re-save with exact commission from request
            dheri = priceCalculatorService.saveToDheri(created.getId(), calcReq);
        }

        Farmer farmer = dheri.getFarmer();
        BigDecimal payable = calc.getFarmerFinalBalance();

        // Post payable once
        if (!Boolean.TRUE.equals(dheri.getPayablePosted()) && payable.compareTo(BigDecimal.ZERO) > 0) {
            farmer.setOutstandingBalance(safe(farmer.getOutstandingBalance()).add(payable));
            farmerRepository.save(farmer);
            dheri.setPayablePosted(true);
            dheriRepository.save(dheri);
        }

        BigDecimal paidNow = defaultBd(request.getPaymentNow(), BigDecimal.ZERO);
        if (paidNow.compareTo(BigDecimal.ZERO) > 0) {
            PaymentRequest pay = new PaymentRequest();
            pay.setPaymentType("FARMER");
            pay.setFarmerId(farmer.getId());
            pay.setDheriId(dheri.getId());
            pay.setAmount(paidNow);
            pay.setPaymentMethod(request.getPaymentMethod());
            pay.setPaymentDate(request.getTransactionDate() != null ? request.getTransactionDate() : LocalDate.now());
            pay.setNotes(request.getNotes() != null ? request.getNotes() : "Arhat farmer payment for " + dheri.getDheriId());
            paymentService.record(pay);
            farmer = farmerRepository.findByIdAndDeletedFalse(farmer.getId()).orElse(farmer);
        }

        return ArhatSettlementResponse.builder()
                .settlementType("FARMER_PAYABLE")
                .dheriId(dheri.getId())
                .dheriCode(dheri.getDheriId())
                .farmerId(farmer.getId())
                .totalAmount(calc.getTotalAmount())
                .commission(calc.getCommission())
                .farmerPayable(payable)
                .paymentNow(paidNow)
                .partyOutstandingAfter(farmer.getOutstandingBalance())
                .calculation(calc)
                .message("Farmer payable recorded for " + dheri.getDheriId()
                        + ". Remaining payable: PKR " + farmer.getOutstandingBalance())
                .build();
    }

    private ArhatSettlementResponse settleBuyerSale(ArhatSettlementRequest request) {
        if (request.getBuyerId() == null) throw new RuntimeException("Buyer is required");
        if (request.getProductId() == null) throw new RuntimeException("Product is required");

        PriceCalculationRequest calcReq = toCalcRequest(request);
        PriceCalculationResult calc = priceCalculatorService.calculate(calcReq);

        String sourceType = request.getFarmerId() != null || request.getDheriId() != null
                ? "FARMER" : "BUSINESS_STOCK";

        SaleItemRequest item = new SaleItemRequest();
        item.setProductId(request.getProductId());
        item.setSourceType(sourceType);
        item.setFarmerId(request.getFarmerId());
        item.setDheriId(request.getDheriId());
        item.setNumberOfBags(request.getNumberOfBags());
        item.setWeightPerBag(defaultBd(request.getWeightPerBag(), new BigDecimal("40")));
        item.setPartialBagWeight(defaultBd(request.getPartialBagWeight(), BigDecimal.ZERO));
        // Buyer pays market total amount (before farmer commission split). Use totalAmount.
        item.setRate(request.getMarketRate());

        // If selling farmer dheri that is not yet payable-posted, ensure pricing saved first
        if (request.getDheriId() != null) {
            priceCalculatorService.saveToDheri(request.getDheriId(), calcReq);
            Dheri dheri = dheriRepository.findByIdAndDeletedFalse(request.getDheriId()).orElse(null);
            if (dheri != null && !Boolean.TRUE.equals(dheri.getPayablePosted())) {
                Farmer farmer = dheri.getFarmer();
                BigDecimal payable = calc.getFarmerFinalBalance();
                if (payable.compareTo(BigDecimal.ZERO) > 0) {
                    farmer.setOutstandingBalance(safe(farmer.getOutstandingBalance()).add(payable));
                    farmerRepository.save(farmer);
                    dheri.setPayablePosted(true);
                    dheriRepository.save(dheri);
                }
            }
        }

        SaleRequest saleRequest = new SaleRequest();
        saleRequest.setBuyerId(request.getBuyerId());
        saleRequest.setSaleDate(request.getTransactionDate() != null ? request.getTransactionDate() : LocalDate.now());
        saleRequest.setPaidAmount(defaultBd(request.getPaymentNow(), BigDecimal.ZERO));
        saleRequest.setNotes(request.getNotes() != null ? request.getNotes() : "Arhat product sale");
        saleRequest.setItems(List.of(item));

        SaleResponse sale = saleService.create(saleRequest);
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(request.getBuyerId()).orElse(null);

        // Link buyer payment to dheri when present
        if (request.getDheriId() != null && defaultBd(request.getPaymentNow(), BigDecimal.ZERO).compareTo(BigDecimal.ZERO) > 0) {
            paymentRepository.findByBuyerIdOrderByPaymentDateDesc(request.getBuyerId()).stream()
                    .filter(p -> p.getSale() != null && p.getSale().getId().equals(sale.getId()))
                    .findFirst()
                    .ifPresent(p -> {
                        dheriRepository.findByIdAndDeletedFalse(request.getDheriId()).ifPresent(d -> {
                            p.setDheri(d);
                            paymentRepository.save(p);
                        });
                    });
        }

        return ArhatSettlementResponse.builder()
                .settlementType("BUYER_SALE")
                .saleId(sale.getId())
                .invoiceNumber(sale.getInvoiceNumber())
                .dheriId(request.getDheriId())
                .buyerId(request.getBuyerId())
                .farmerId(request.getFarmerId())
                .totalAmount(sale.getTotalAmount())
                .commission(calc.getCommission())
                .farmerPayable(calc.getFarmerFinalBalance())
                .buyerReceivable(sale.getTotalAmount().subtract(sale.getPaidAmount()))
                .paymentNow(sale.getPaidAmount())
                .partyOutstandingAfter(buyer != null ? buyer.getOutstandingBalance() : BigDecimal.ZERO)
                .calculation(calc)
                .message("Buyer sale " + sale.getInvoiceNumber() + " created. Remaining receivable: PKR "
                        + (buyer != null ? buyer.getOutstandingBalance() : "0"))
                .build();
    }

    private PriceCalculationRequest toCalcRequest(ArhatSettlementRequest request) {
        return PriceCalculationRequest.builder()
                .numberOfBags(request.getNumberOfBags())
                .weightPerBag(defaultBd(request.getWeightPerBag(), new BigDecimal("40")))
                .partialBagWeight(defaultBd(request.getPartialBagWeight(), BigDecimal.ZERO))
                .marketRate(request.getMarketRate())
                .commissionPercentage(request.getCommissionPercentage())
                .arhatSharePercentage(request.getArhatSharePercentage())
                .munshiNigranSharePercentage(request.getMunshiNigranSharePercentage())
                .workersSharePercentage(request.getWorkersSharePercentage())
                .build();
    }

    private BigDecimal defaultBd(BigDecimal value, BigDecimal fallback) {
        return value != null ? value : fallback;
    }

    private BigDecimal safe(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
