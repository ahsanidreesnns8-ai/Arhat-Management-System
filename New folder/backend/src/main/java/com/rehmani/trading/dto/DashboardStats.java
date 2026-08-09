package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class DashboardStats {
    private BigDecimal todaySales;
    private long currentQueue;
    private long totalFarmers;
    private long totalBuyers;
    private long totalDheris;
    private BigDecimal currentStock;
    private BigDecimal pendingPayments;
    private BigDecimal revenue;
    private BigDecimal commission;
    private List<RecentActivityDto> recentActivity;
}
