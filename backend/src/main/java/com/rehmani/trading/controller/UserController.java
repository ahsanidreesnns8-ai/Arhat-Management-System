package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.UserRequest;
import com.rehmani.trading.dto.UserResponse;
import com.rehmani.trading.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ApiResponse<List<UserResponse>> list() {
        return ApiResponse.ok(userService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<UserResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(userService.getById(id));
    }

    @PostMapping
    public ApiResponse<UserResponse> create(@Valid @RequestBody UserRequest request) {
        return ApiResponse.ok("User created", userService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<UserResponse> update(@PathVariable Long id, @Valid @RequestBody UserRequest request) {
        return ApiResponse.ok("User updated", userService.update(id, request));
    }

    @PatchMapping("/{id}/suspend")
    public ApiResponse<Void> suspend(@PathVariable Long id) {
        userService.suspend(id);
        return ApiResponse.ok("User suspended", null);
    }

    @PatchMapping("/{id}/activate")
    public ApiResponse<Void> activate(@PathVariable Long id) {
        userService.activate(id);
        return ApiResponse.ok("User activated", null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return ApiResponse.ok("User deleted", null);
    }
}
