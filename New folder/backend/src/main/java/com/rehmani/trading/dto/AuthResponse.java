package com.rehmani.trading.dto;

import com.rehmani.trading.entity.ThemePreference;
import com.rehmani.trading.entity.UserRole;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponse {
    private String token;
    private Long id;
    private String username;
    private String fullName;
    private String email;
    private UserRole role;
    private ThemePreference themePreference;
    private String companyName;
}
