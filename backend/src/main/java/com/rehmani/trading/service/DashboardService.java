package com.rehmani.trading.service;

import com.rehmani.trading.dto.DashboardStats;
import com.rehmani.trading.dto.RecentActivityDto;
import com.rehmani.trading.entity.AuditLog;
import com.rehmani.trading.entity.QueueStatus;
import com.rehmani.trading.entity.SellingStatus;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final SaleRepository saleRepository;
    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final DheriRepository dheriRepository;
    private final StockRepository stockRepository;
    private final QueueEntryRepository queueEntryRepository;
    private final AuditLogRepository auditLogRepository;

    public DashboardStats getStats() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime startOfTomorrow = today.plusDays(1).atStartOfDay();

        BigDecimal todaySales = saleRepository.getTotalSalesByDate(today);
        if (todaySales == null) todaySales = BigDecimal.ZERO;

        BigDecimal currentStock = stockRepository.getTotalStockQuantity();
        if (currentStock == null) currentStock = BigDecimal.ZERO;

        BigDecimal pendingPayments = buyerRepository.sumOutstandingBalances();
        if (pendingPayments == null) pendingPayments = BigDecimal.ZERO;

        BigDecimal commission = dheriRepository.sumArhatShareByStatusAndUpdatedAtBetween(
                SellingStatus.SOLD, startOfDay, startOfTomorrow);
        if (commission == null) commission = BigDecimal.ZERO;

        List<RecentActivityDto> recentActivity = auditLogRepository.findTop50ByOrderByCreatedAtDesc()
                .stream()
                .limit(10)
                .map(this::toActivityDto)
                .toList();

        return DashboardStats.builder()
                .todaySales(todaySales)
                .currentQueue(queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.PENDING).size())
                .totalFarmers(farmerRepository.countByDeletedFalse())
                .totalBuyers(buyerRepository.countByDeletedFalse())
                .totalDheris(dheriRepository.findByDeletedFalseOrderByCreatedAtDesc().size())
                .currentStock(currentStock)
                .pendingPayments(pendingPayments)
                .revenue(todaySales)
                .commission(commission)
                .recentActivity(recentActivity)
                .build();
    }

    private RecentActivityDto toActivityDto(AuditLog log) {
        return RecentActivityDto.builder()
                .action(log.getAction())
                .entityType(log.getEntityType())
                .description(log.getAction() + " on " + log.getEntityType())
                .timestamp(log.getCreatedAt())
                .build();
    }
}
