package com.rehmani.trading.service;

import com.rehmani.trading.exception.UnauthorizedException;
import com.rehmani.trading.dto.*;
import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import com.rehmani.trading.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 15;

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final BusinessSettingsRepository settingsRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsernameAndDeletedFalse(request.getUsername())
                .orElse(null);

        if (user != null && user.getLockedUntil() != null
                && user.getLockedUntil().isAfter(LocalDateTime.now())) {
            throw new UnauthorizedException("Account temporarily locked. Try again later.");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));
        } catch (AuthenticationException ex) {
            handleFailedLogin(request.getUsername());
            throw new UnauthorizedException("Access Denied");
        }

        user = userRepository.findByUsernameAndDeletedFalse(request.getUsername())
                .orElseThrow(() -> new UnauthorizedException("Access Denied"));

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
        String token = jwtTokenProvider.generateToken(userDetails);

        String companyName = settingsRepository.findAll().stream()
                .findFirst()
                .map(BusinessSettings::getCompanyName)
                .orElse("Rehmani Trading Company");

        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .themePreference(user.getThemePreference())
                .companyName(companyName)
                .build();
    }

    private void handleFailedLogin(String username) {
        userRepository.findByUsernameAndDeletedFalse(username).ifPresent(user -> {
            int attempts = (user.getFailedLoginAttempts() != null ? user.getFailedLoginAttempts() : 0) + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(LocalDateTime.now().plusMinutes(LOCKOUT_MINUTES));
            }
            userRepository.save(user);
        });
    }

    @Transactional
    public void updateTheme(String username, ThemePreference theme) {
        User user = userRepository.findByUsernameAndDeletedFalse(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setThemePreference(theme);
        userRepository.save(user);
    }
}
