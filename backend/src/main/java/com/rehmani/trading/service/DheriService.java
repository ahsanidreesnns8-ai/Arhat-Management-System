package com.rehmani.trading.service;

import com.rehmani.trading.dto.DheriRequest;
import com.rehmani.trading.dto.DheriResponse;
import com.rehmani.trading.dto.PriceCalculationRequest;
import com.rehmani.trading.dto.PriceCalculationResult;
import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DheriService {

    private final DheriRepository dheriRepository;
    private final FarmerRepository farmerRepository;
    private final TruckRepository truckRepository;
    private final ProductRepository productRepository;
    private final BusinessSettingsRepository settingsRepository;
    private final PriceCalculatorService priceCalculatorService;

    public List<DheriResponse> getAll() {
        return dheriRepository.findByDeletedFalseOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public List<DheriResponse> getByFarmer(Long farmerId) {
        farmerRepository.findByIdAndDeletedFalse(farmerId)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        return dheriRepository.findByFarmerIdAndDeletedFalse(farmerId)
                .stream().map(this::toResponse).toList();
    }

    public DheriResponse getById(Long id) {
        Dheri dheri = dheriRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Dheri not found"));
        return toResponse(dheri);
    }

    @Transactional
    public DheriResponse create(DheriRequest request) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(request.getFarmerId())
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        Truck truck = null;
        if (request.getTruckId() != null) {
            truck = truckRepository.findByIdAndDeletedFalse(request.getTruckId())
                    .orElseThrow(() -> new RuntimeException("Truck not found"));
        }

        var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
        var commissionPct = settings != null ? settings.getDefaultCommissionPercentage() : new java.math.BigDecimal("4.00");

        int bags = request.getNumberOfBags() != null ? request.getNumberOfBags() : 0;
        var weightPerBag = request.getWeightPerBag() != null ? request.getWeightPerBag() : new java.math.BigDecimal("40");
        var partial = request.getPartialBagWeight() != null ? request.getPartialBagWeight() : java.math.BigDecimal.ZERO;
        var marketRate = request.getMarketRate() != null ? request.getMarketRate() : java.math.BigDecimal.ZERO;

        PriceCalculationResult calc = priceCalculatorService.calculate(PriceCalculationRequest.builder()
                .numberOfBags(bags)
                .weightPerBag(weightPerBag)
                .partialBagWeight(partial)
                .marketRate(marketRate)
                .commissionPercentage(commissionPct)
                .build());

        Dheri dheri = Dheri.builder()
                .dheriId(generateDheriId())
                .farmer(farmer)
                .truck(truck)
                .product(product)
                .numberOfBags(bags)
                .weightPerBag(weightPerBag)
                .partialBagWeight(partial)
                .marketRate(marketRate)
                .commissionPercentage(calc.getCommissionPercentage())
                .totalWeight(calc.getTotalWeight())
                .totalPrice(calc.getTotalAmount())
                .commissionAmount(calc.getCommission())
                .farmerReceivable(calc.getFarmerFinalBalance())
                .supervisorShare(calc.getMunshiNigranShare())
                .laborShare(calc.getWorkersShare())
                .arhatShare(calc.getArhatShare())
                .notes(request.getNotes())
                .build();

        return toResponse(dheriRepository.save(dheri));
    }

    @Transactional
    public DheriResponse update(Long id, DheriRequest request) {
        Dheri dheri = dheriRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Dheri not found"));

        if (request.getFarmerId() != null) {
            Farmer farmer = farmerRepository.findByIdAndDeletedFalse(request.getFarmerId())
                    .orElseThrow(() -> new RuntimeException("Farmer not found"));
            dheri.setFarmer(farmer);
        }
        if (request.getProductId() != null) {
            Product product = productRepository.findById(request.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found"));
            dheri.setProduct(product);
        }
        if (request.getTruckId() != null) {
            Truck truck = truckRepository.findByIdAndDeletedFalse(request.getTruckId())
                    .orElseThrow(() -> new RuntimeException("Truck not found"));
            dheri.setTruck(truck);
        }
        if (request.getNumberOfBags() != null) dheri.setNumberOfBags(request.getNumberOfBags());
        if (request.getWeightPerBag() != null) dheri.setWeightPerBag(request.getWeightPerBag());
        if (request.getPartialBagWeight() != null) dheri.setPartialBagWeight(request.getPartialBagWeight());
        if (request.getMarketRate() != null) dheri.setMarketRate(request.getMarketRate());
        if (request.getNotes() != null) dheri.setNotes(request.getNotes());

        return toResponse(dheriRepository.save(dheri));
    }

    @Transactional
    public void delete(Long id) {
        Dheri dheri = dheriRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Dheri not found"));
        dheri.setDeleted(true);
        dheriRepository.save(dheri);
    }

    private String generateDheriId() {
        Integer max = dheriRepository.findMaxDheriNumber();
        int next = (max != null ? max : 0) + 1;
        return String.format("DHR%05d", next);
    }

    DheriResponse toResponse(Dheri dheri) {
        return DheriResponse.builder()
                .id(dheri.getId())
                .dheriId(dheri.getDheriId())
                .farmerId(dheri.getFarmer().getId())
                .farmerName(dheri.getFarmer().getName())
                .farmerCode(dheri.getFarmer().getFarmerId())
                .truckId(dheri.getTruck() != null ? dheri.getTruck().getId() : null)
                .truckCode(dheri.getTruck() != null ? dheri.getTruck().getTruckId() : null)
                .productId(dheri.getProduct().getId())
                .productName(dheri.getProduct().getName())
                .queueNumber(dheri.getQueueNumber())
                .numberOfBags(dheri.getNumberOfBags())
                .weightPerBag(dheri.getWeightPerBag())
                .partialBagWeight(dheri.getPartialBagWeight())
                .totalWeight(dheri.getTotalWeight())
                .marketRate(dheri.getMarketRate())
                .commissionPercentage(dheri.getCommissionPercentage())
                .totalPrice(dheri.getTotalPrice())
                .commissionAmount(dheri.getCommissionAmount())
                .farmerReceivable(dheri.getFarmerReceivable())
                .supervisorShare(dheri.getSupervisorShare())
                .laborShare(dheri.getLaborShare())
                .arhatShare(dheri.getArhatShare())
                .sellingStatus(dheri.getSellingStatus().name())
                .notes(dheri.getNotes())
                .build();
    }
}
