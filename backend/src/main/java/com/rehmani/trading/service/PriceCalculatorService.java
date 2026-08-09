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

/**
 * Price formula: (bags × weightPerBag + partialKg) / 40 × marketRatePer40kg
 *
 * Commission of TOTAL amount (site-wide):
 *   Arhat 3% + Munshi/Nigran 0.70% + Workers 0.30% = 4%
 */
@Service
@RequiredArgsConstructor
public class PriceCalculatorService {

    private static final BigDecimal MANN_WEIGHT = new BigDecimal("40");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final BusinessSettingsRepository settingsRepository;
    private final DheriRepository dheriRepository;

    public PriceCalculationResult calculate(PriceCalculationRequest request) {
        BusinessSettings settings = getSettings();

        int bags = request.getNumberOfBags() != null ? request.getNumberOfBags() : 0;
        BigDecimal weightPerBag = defaultIfNull(request.getWeightPerBag(), MANN_WEIGHT);
        BigDecimal partialBagWeight = defaultIfNull(request.getPartialBagWeight(), BigDecimal.ZERO);
        BigDecimal pricePerMann = defaultIfNull(request.getMarketRate(), BigDecimal.ZERO);

        // Shares are percentages of TOTAL AMOUNT
        BigDecimal arhatPct = defaultIfNull(request.getArhatSharePercentage(),
                defaultIfNull(settings.getArhatSharePercentage(), new BigDecimal("3.00")));
        BigDecimal munshiPct = defaultIfNull(request.getMunshiNigranSharePercentage(),
                defaultIfNull(settings.getSupervisorSharePercentage(), new BigDecimal("0.70")));
        BigDecimal workersPct = defaultIfNull(request.getWorkersSharePercentage(),
                defaultIfNull(settings.getLaborSharePercentage(), new BigDecimal("0.30")));

        BigDecimal shareSum = arhatPct.add(munshiPct).add(workersPct);
        BigDecimal commissionPct = request.getCommissionPercentage();
        if (commissionPct == null) {
            commissionPct = shareSum.compareTo(BigDecimal.ZERO) > 0
                    ? shareSum
                    : defaultIfNull(settings.getDefaultCommissionPercentage(), new BigDecimal("4.00"));
        }

        // If only total commission % was overridden, scale the three shares proportionally
        if (shareSum.compareTo(BigDecimal.ZERO) > 0
                && commissionPct.compareTo(shareSum) != 0
                && request.getArhatSharePercentage() == null
                && request.getMunshiNigranSharePercentage() == null
                && request.getWorkersSharePercentage() == null
                && request.getCommissionPercentage() != null) {
            BigDecimal factor = commissionPct.divide(shareSum, 8, RoundingMode.HALF_UP);
            arhatPct = arhatPct.multiply(factor).setScale(4, RoundingMode.HALF_UP);
            munshiPct = munshiPct.multiply(factor).setScale(4, RoundingMode.HALF_UP);
            workersPct = workersPct.multiply(factor).setScale(4, RoundingMode.HALF_UP);
            shareSum = arhatPct.add(munshiPct).add(workersPct);
        } else if (request.getCommissionPercentage() == null) {
            commissionPct = shareSum;
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

        BigDecimal arhatShare = percentOf(totalAmount, arhatPct);
        BigDecimal munshiShare = percentOf(totalAmount, munshiPct);
        BigDecimal workersShare = percentOf(totalAmount, workersPct);
        BigDecimal commission = arhatShare.add(munshiShare).add(workersShare);
        BigDecimal farmerFinalBalance = totalAmount.subtract(commission);

        return PriceCalculationResult.builder()
                .totalWeight(totalWeight)
                .totalUnitsWhole(totalUnitsWhole)
                .remainderKg(remainderKg)
                .totalMann(totalMann.setScale(2, RoundingMode.HALF_UP))
                .totalAmount(totalAmount)
                .commissionPercentage(commissionPct.setScale(2, RoundingMode.HALF_UP))
                .commission(commission)
                .farmerFinalBalance(farmerFinalBalance)
                .arhatShare(arhatShare)
                .munshiNigranShare(munshiShare)
                .workersShare(workersShare)
                .arhatSharePercentage(arhatPct.setScale(2, RoundingMode.HALF_UP))
                .munshiNigranSharePercentage(munshiPct.setScale(2, RoundingMode.HALF_UP))
                .workersSharePercentage(workersPct.setScale(2, RoundingMode.HALF_UP))
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

    private BigDecimal percentOf(BigDecimal amount, BigDecimal pct) {
        return amount.multiply(pct).divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }

    private BusinessSettings getSettings() {
        return settingsRepository.findAll().stream()
                .findFirst()
                .orElse(BusinessSettings.builder()
                        .defaultCommissionPercentage(new BigDecimal("4.00"))
                        .arhatSharePercentage(new BigDecimal("3.00"))
                        .supervisorSharePercentage(new BigDecimal("0.70"))
                        .laborSharePercentage(new BigDecimal("0.30"))
                        .build());
    }

    private BigDecimal defaultIfNull(BigDecimal value, BigDecimal defaultValue) {
        return value != null ? value : defaultValue;
    }
}
