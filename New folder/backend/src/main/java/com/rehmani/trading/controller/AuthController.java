package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.entity.ThemePreference;
import com.rehmani.trading.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @PutMapping("/theme")
    public ApiResponse<Void> updateTheme(
            @RequestParam ThemePreference theme,
            @RequestParam String username) {
        authService.updateTheme(username, theme);
        return ApiResponse.ok("Theme updated", null);
    }
}
