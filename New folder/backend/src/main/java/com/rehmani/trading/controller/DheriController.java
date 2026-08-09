package com.rehmani.trading.controller;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.service.DheriService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/dheris")
@RequiredArgsConstructor
public class DheriController {

    private final DheriService dheriService;

    @GetMapping
    public ApiResponse<List<DheriResponse>> getAll() {
        return ApiResponse.ok(dheriService.getAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<DheriResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(dheriService.getById(id));
    }

    @PostMapping
    public ApiResponse<DheriResponse> create(@Valid @RequestBody DheriRequest request) {
        return ApiResponse.ok("Dheri created", dheriService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<DheriResponse> update(@PathVariable Long id, @Valid @RequestBody DheriRequest request) {
        return ApiResponse.ok("Dheri updated", dheriService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        dheriService.delete(id);
        return ApiResponse.ok("Dheri deleted", null);
    }
}
