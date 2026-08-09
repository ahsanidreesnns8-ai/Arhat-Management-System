package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.QueueEntryResponse;
import com.rehmani.trading.service.QueueService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/queue")
@RequiredArgsConstructor
public class QueueController {

    private final QueueService queueService;

    @GetMapping("/pending")
    public ApiResponse<List<QueueEntryResponse>> getPending() {
        return ApiResponse.ok(queueService.getPending());
    }

    @GetMapping("/active")
    public ApiResponse<List<QueueEntryResponse>> getActive() {
        return ApiResponse.ok(queueService.getActive());
    }

    @GetMapping("/completed")
    public ApiResponse<List<QueueEntryResponse>> getCompleted() {
        return ApiResponse.ok(queueService.getCompleted());
    }

    @PostMapping("/add/{dheriId}")
    public ApiResponse<QueueEntryResponse> addToQueue(@PathVariable Long dheriId) {
        return ApiResponse.ok("Added to queue", queueService.addToQueue(dheriId));
    }

    @PostMapping("/{id}/activate")
    public ApiResponse<QueueEntryResponse> activate(@PathVariable Long id) {
        return ApiResponse.ok("Queue activated", queueService.activate(id));
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<QueueEntryResponse> complete(@PathVariable Long id) {
        return ApiResponse.ok("Queue completed", queueService.complete(id));
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<QueueEntryResponse> cancel(@PathVariable Long id) {
        return ApiResponse.ok("Queue cancelled", queueService.cancel(id));
    }
}
