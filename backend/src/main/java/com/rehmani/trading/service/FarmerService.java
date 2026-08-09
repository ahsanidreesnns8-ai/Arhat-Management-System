package com.rehmani.trading.service;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.entity.Dheri;
import com.rehmani.trading.entity.Farmer;
import com.rehmani.trading.entity.Payment;
import com.rehmani.trading.entity.Truck;
import com.rehmani.trading.repository.DheriRepository;
import com.rehmani.trading.repository.FarmerRepository;
import com.rehmani.trading.repository.PaymentRepository;
import com.rehmani.trading.repository.TruckRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FarmerService {

    private final FarmerRepository farmerRepository;
    private final PaymentRepository paymentRepository;
    private final DheriRepository dheriRepository;
    private final TruckRepository truckRepository;
    private final PaymentService paymentService;
    private final DheriService dheriService;
    private final TruckService truckService;

    public List<FarmerResponse> getAll() {
        return farmerRepository.findByDeletedFalseOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public FarmerResponse getById(Long id) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        return toResponse(farmer);
    }

    public EntityLedgerResponse getLedger(Long id) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));

        List<PaymentResponse> payments = paymentRepository.findByFarmerIdOrderByPaymentDateDesc(id)
                .stream().map(paymentService::toResponse).toList();

        List<DheriResponse> dheris = dheriRepository.findByFarmerIdAndDeletedFalse(id)
                .stream().map(dheriService::toResponse).toList();

        List<TruckResponse> trucks = truckRepository.findByFarmerIdAndDeletedFalse(id)
                .stream().map(truckService::toResponse).toList();

        List<LedgerEntryDto> entries = new ArrayList<>();
        for (Dheri dheri : dheriRepository.findByFarmerIdAndDeletedFalse(id)) {
            if (dheri.getFarmerReceivable() != null && dheri.getFarmerReceivable().signum() > 0) {
                entries.add(LedgerEntryDto.builder()
                        .date(dheri.getCreatedAt() != null ? dheri.getCreatedAt().toLocalDate() : null)
                        .entryType("DHERI")
                        .description("Dheri " + dheri.getDheriId() + " receivable")
                        .amount(dheri.getFarmerReceivable())
                        .referenceId(dheri.getId())
                        .referenceType("Dheri")
                        .build());
            }
        }
        for (Payment payment : paymentRepository.findByFarmerIdOrderByPaymentDateDesc(id)) {
            entries.add(LedgerEntryDto.builder()
                    .date(payment.getPaymentDate())
                    .entryType("PAYMENT")
                    .description("Payment received")
                    .amount(payment.getAmount().negate())
                    .referenceId(payment.getId())
                    .referenceType("Payment")
                    .build());
        }
        entries.sort(Comparator.comparing(LedgerEntryDto::getDate, Comparator.nullsLast(Comparator.reverseOrder())));

        return EntityLedgerResponse.builder()
                .balance(farmer.getOutstandingBalance())
                .entries(entries)
                .payments(payments)
                .dheris(dheris)
                .trucks(trucks)
                .build();
    }

    @Transactional
    public FarmerResponse create(FarmerRequest request) {
        Farmer farmer = Farmer.builder()
                .farmerId(generateFarmerId())
                .name(request.getName())
                .cnic(request.getCnic())
                .phone(request.getPhone())
                .address(request.getAddress())
                .city(request.getCity())
                .notes(request.getNotes())
                .build();
        return toResponse(farmerRepository.save(farmer));
    }

    @Transactional
    public FarmerResponse update(Long id, FarmerRequest request) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        farmer.setName(request.getName());
        farmer.setCnic(request.getCnic());
        farmer.setPhone(request.getPhone());
        farmer.setAddress(request.getAddress());
        farmer.setCity(request.getCity());
        farmer.setNotes(request.getNotes());
        return toResponse(farmerRepository.save(farmer));
    }

    @Transactional
    public void delete(Long id) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        farmer.setDeleted(true);
        farmerRepository.save(farmer);
    }

    private String generateFarmerId() {
        Integer max = farmerRepository.findMaxFarmerNumber();
        int next = (max != null ? max : 0) + 1;
        return String.format("FRM%05d", next);
    }

    FarmerResponse toResponse(Farmer farmer) {
        return FarmerResponse.builder()
                .id(farmer.getId())
                .farmerId(farmer.getFarmerId())
                .name(farmer.getName())
                .cnic(farmer.getCnic())
                .phone(farmer.getPhone())
                .address(farmer.getAddress())
                .city(farmer.getCity())
                .outstandingBalance(farmer.getOutstandingBalance())
                .notes(farmer.getNotes())
                .active(farmer.getActive())
                .build();
    }
}
