package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.DashboardStats;
import com.rehmani.trading.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public ApiResponse<DashboardStats> getStats() {
        return ApiResponse.ok(dashboardService.getStats());
    }
}
