package com.rehmani.trading.service;

import com.rehmani.trading.dto.UserRequest;
import com.rehmani.trading.dto.UserResponse;
import com.rehmani.trading.entity.User;
import com.rehmani.trading.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public List<UserResponse> list() {
        return userRepository.findByDeletedFalseOrderByCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public UserResponse getById(Long id) {
        return toResponse(findUser(id));
    }

    @Transactional
    public UserResponse create(UserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username already exists");
        }
        if (userRepository.findByEmailAndDeletedFalse(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new RuntimeException("Password is required");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(request.getRole())
                .active(request.getActive() != null ? request.getActive() : true)
                .build();
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse update(Long id, UserRequest request) {
        User user = findUser(id);

        if (userRepository.existsByUsernameAndIdNot(request.getUsername(), id)) {
            throw new RuntimeException("Username already exists");
        }
        if (userRepository.existsByEmailAndIdNot(request.getEmail(), id)) {
            throw new RuntimeException("Email already exists");
        }

        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setRole(request.getRole());
        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void activate(Long id) {
        User user = findUser(id);
        user.setActive(true);
        userRepository.save(user);
    }

    @Transactional
    public void suspend(Long id) {
        User user = findUser(id);
        user.setActive(false);
        userRepository.save(user);
    }

    @Transactional
    public void delete(Long id) {
        User user = findUser(id);
        user.setDeleted(true);
        user.setActive(false);
        userRepository.save(user);
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .themePreference(user.getThemePreference())
                .active(user.getActive())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
