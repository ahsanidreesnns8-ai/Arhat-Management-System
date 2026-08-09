package com.rehmani.trading.service;

import com.rehmani.trading.dto.PriceCalculationRequest;
import com.rehmani.trading.dto.PriceCalculationResult;
import com.rehmani.trading.entity.BusinessSettings;
import com.rehmani.trading.entity.Dheri;
import com.rehmani.trading.repository.BusinessSettingsRepository;
import com.rehmani.trading.repository.DheriRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class PriceCalculatorService {

    private static final BigDecimal MANN_WEIGHT = new BigDecimal("40");

    private final BusinessSettingsRepository settingsRepository;
    private final DheriRepository dheriRepository;

    public PriceCalculationResult calculate(PriceCalculationRequest request) {
        BusinessSettings settings = getSettings();

        int bags = request.getNumberOfBags() != null ? request.getNumberOfBags() : 0;
        BigDecimal weightPerBag = defaultIfNull(request.getWeightPerBag(), MANN_WEIGHT);
        BigDecimal partialBagWeight = defaultIfNull(request.getPartialBagWeight(), BigDecimal.ZERO);
        BigDecimal pricePerMann = defaultIfNull(request.getMarketRate(), BigDecimal.ZERO);

        BigDecimal commissionPct = request.getCommissionPercentage();
        if (commissionPct == null) {
            commissionPct = settings.getDefaultCommissionPercentage();
        }

        BigDecimal totalWeight = weightPerBag.multiply(BigDecimal.valueOf(bags))
                .add(partialBagWeight)
                .setScale(2, RoundingMode.HALF_UP);

        int totalUnitsWhole = 0;
        BigDecimal remainderKg = BigDecimal.ZERO;
        if (weightPerBag.compareTo(BigDecimal.ZERO) > 0) {
            totalUnitsWhole = totalWeight.divide(weightPerBag, 0, RoundingMode.DOWN).intValue();
            remainderKg = totalWeight.subtract(weightPerBag.multiply(BigDecimal.valueOf(totalUnitsWhole)))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal totalMann = totalWeight.divide(MANN_WEIGHT, 4, RoundingMode.HALF_UP);
        BigDecimal totalAmount = totalMann.multiply(pricePerMann).setScale(2, RoundingMode.HALF_UP);

        BigDecimal commission = totalAmount.multiply(commissionPct)
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal farmerFinalBalance = totalAmount.subtract(commission);

        BigDecimal arhatPct = request.getArhatSharePercentage() != null
                ? request.getArhatSharePercentage() : settings.getArhatSharePercentage();
        BigDecimal munshiPct = request.getMunshiNigranSharePercentage() != null
                ? request.getMunshiNigranSharePercentage() : settings.getSupervisorSharePercentage();
        BigDecimal workersPct = request.getWorkersSharePercentage() != null
                ? request.getWorkersSharePercentage() : settings.getLaborSharePercentage();

        BigDecimal arhatShare = commission.multiply(arhatPct)
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal munshiShare = commission.multiply(munshiPct)
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal workersShare = commission.multiply(workersPct)
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        return PriceCalculationResult.builder()
                .totalWeight(totalWeight)
                .totalUnitsWhole(totalUnitsWhole)
                .remainderKg(remainderKg)
                .totalMann(totalMann.setScale(2, RoundingMode.HALF_UP))
                .totalAmount(totalAmount)
                .commissionPercentage(commissionPct)
                .commission(commission)
                .farmerFinalBalance(farmerFinalBalance)
                .arhatShare(arhatShare)
                .munshiNigranShare(munshiShare)
                .workersShare(workersShare)
                .arhatSharePercentage(arhatPct)
                .munshiNigranSharePercentage(munshiPct)
                .workersSharePercentage(workersPct)
                .build();
    }

    @Transactional
    public Dheri saveToDheri(Long dheriId, PriceCalculationRequest request) {
        Dheri dheri = dheriRepository.findByIdAndDeletedFalse(dheriId)
                .orElseThrow(() -> new RuntimeException("Dheri not found"));

        PriceCalculationResult result = calculate(request);

        dheri.setNumberOfBags(request.getNumberOfBags() != null ? request.getNumberOfBags() : 0);
        dheri.setWeightPerBag(defaultIfNull(request.getWeightPerBag(), MANN_WEIGHT));
        dheri.setPartialBagWeight(defaultIfNull(request.getPartialBagWeight(), BigDecimal.ZERO));
        dheri.setTotalWeight(result.getTotalWeight());
        dheri.setMarketRate(defaultIfNull(request.getMarketRate(), BigDecimal.ZERO));
        dheri.setCommissionPercentage(result.getCommissionPercentage());
        dheri.setTotalPrice(result.getTotalAmount());
        dheri.setCommissionAmount(result.getCommission());
        dheri.setFarmerReceivable(result.getFarmerFinalBalance());
        dheri.setArhatShare(result.getArhatShare());
        dheri.setSupervisorShare(result.getMunshiNigranShare());
        dheri.setLaborShare(result.getWorkersShare());

        return dheriRepository.save(dheri);
    }

    private BusinessSettings getSettings() {
        return settingsRepository.findAll().stream()
                .findFirst()
                .orElse(BusinessSettings.builder().build());
    }

    private BigDecimal defaultIfNull(BigDecimal value, BigDecimal defaultValue) {
        return value != null ? value : defaultValue;
    }
}
