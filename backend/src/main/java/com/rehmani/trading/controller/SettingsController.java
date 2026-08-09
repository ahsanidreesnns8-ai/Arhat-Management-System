package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping("/public")
    public ApiResponse<BusinessSettingsResponse> getPublicSettings() {
        return ApiResponse.ok(settingsService.getSettings());
    }

    @GetMapping
    public ApiResponse<BusinessSettingsResponse> getSettings() {
        return ApiResponse.ok(settingsService.getSettings());
    }

    @PutMapping
    public ApiResponse<BusinessSettingsResponse> updateSettings(@RequestBody BusinessSettingsRequest request) {
        return ApiResponse.ok("Settings updated", settingsService.updateSettings(request));
    }

    @GetMapping("/products")
    public ApiResponse<List<ProductResponse>> getProducts() {
        return ApiResponse.ok(settingsService.getProducts());
    }
}
