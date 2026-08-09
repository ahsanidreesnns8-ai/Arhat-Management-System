package com.rehmani.trading.dto;

import com.rehmani.trading.entity.ThemePreference;
import com.rehmani.trading.entity.UserRole;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private UserRole role;
    private ThemePreference themePreference;
    private Boolean active;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
}
