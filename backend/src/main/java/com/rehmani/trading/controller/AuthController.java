package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.entity.ThemePreference;
import com.rehmani.trading.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
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

    /** Theme is bound to the authenticated JWT user (not a public username param). */
    @PutMapping("/theme")
    public ApiResponse<Void> updateTheme(
            @RequestParam ThemePreference theme,
            Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new IllegalArgumentException("Authentication required");
        }
        authService.updateTheme(authentication.getName(), theme);
        return ApiResponse.ok("Theme updated", null);
    }
}
