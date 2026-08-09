package com.rehmani.trading.service;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.entity.Buyer;
import com.rehmani.trading.entity.Payment;
import com.rehmani.trading.entity.Sale;
import com.rehmani.trading.repository.BuyerRepository;
import com.rehmani.trading.repository.PaymentRepository;
import com.rehmani.trading.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BuyerService {

    private final BuyerRepository buyerRepository;
    private final PaymentRepository paymentRepository;
    private final SaleRepository saleRepository;
    private final PaymentService paymentService;
    private final SaleService saleService;

    public List<BuyerResponse> getAll() {
        return buyerRepository.findByDeletedFalseOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public BuyerResponse getById(Long id) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        return toResponse(buyer);
    }

    public EntityLedgerResponse getLedger(Long id) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));

        List<PaymentResponse> payments = paymentRepository.findByBuyerIdOrderByPaymentDateDesc(id)
                .stream().map(paymentService::toResponse).toList();

        List<SaleResponse> sales = saleRepository.findByBuyerIdAndDeletedFalseOrderBySaleDateDescCreatedAtDesc(id)
                .stream().map(saleService::toResponse).toList();

        List<LedgerEntryDto> entries = new ArrayList<>();
        for (Sale sale : saleRepository.findByBuyerIdAndDeletedFalseOrderBySaleDateDescCreatedAtDesc(id)) {
            entries.add(LedgerEntryDto.builder()
                    .date(sale.getSaleDate())
                    .entryType("SALE")
                    .description("Sale " + sale.getInvoiceNumber())
                    .amount(sale.getTotalAmount())
                    .referenceId(sale.getId())
                    .referenceType("Sale")
                    .build());
        }
        for (Payment payment : paymentRepository.findByBuyerIdOrderByPaymentDateDesc(id)) {
            entries.add(LedgerEntryDto.builder()
                    .date(payment.getPaymentDate())
                    .entryType("PAYMENT")
                    .description("Payment made")
                    .amount(payment.getAmount().negate())
                    .referenceId(payment.getId())
                    .referenceType("Payment")
                    .build());
        }
        entries.sort(Comparator.comparing(LedgerEntryDto::getDate, Comparator.nullsLast(Comparator.reverseOrder())));

        return EntityLedgerResponse.builder()
                .balance(buyer.getOutstandingBalance())
                .entries(entries)
                .payments(payments)
                .sales(sales)
                .build();
    }

    @Transactional
    public BuyerResponse create(BuyerRequest request) {
        Buyer buyer = Buyer.builder()
                .buyerId(generateBuyerId())
                .name(request.getName())
                .cnic(request.getCnic())
                .phone(request.getPhone())
                .address(request.getAddress())
                .city(request.getCity())
                .notes(request.getNotes())
                .build();
        return toResponse(buyerRepository.save(buyer));
    }

    @Transactional
    public BuyerResponse update(Long id, BuyerRequest request) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        buyer.setName(request.getName());
        buyer.setCnic(request.getCnic());
        buyer.setPhone(request.getPhone());
        buyer.setAddress(request.getAddress());
        buyer.setCity(request.getCity());
        buyer.setNotes(request.getNotes());
        return toResponse(buyerRepository.save(buyer));
    }

    @Transactional
    public void delete(Long id) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        buyer.setDeleted(true);
        buyerRepository.save(buyer);
    }

    private String generateBuyerId() {
        Integer max = buyerRepository.findMaxBuyerNumber();
        int next = (max != null ? max : 0) + 1;
        return String.format("BYR%05d", next);
    }

    BuyerResponse toResponse(Buyer buyer) {
        return BuyerResponse.builder()
                .id(buyer.getId())
                .buyerId(buyer.getBuyerId())
                .name(buyer.getName())
                .cnic(buyer.getCnic())
                .phone(buyer.getPhone())
                .address(buyer.getAddress())
                .city(buyer.getCity())
                .outstandingBalance(buyer.getOutstandingBalance())
                .notes(buyer.getNotes())
                .active(buyer.getActive())
                .build();
    }
}
