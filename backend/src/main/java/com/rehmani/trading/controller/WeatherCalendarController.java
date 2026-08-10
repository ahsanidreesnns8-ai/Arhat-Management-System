package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.WeatherCalendarResponse;
import com.rehmani.trading.service.WeatherCalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/weather")
@RequiredArgsConstructor
public class WeatherCalendarController {

    private final WeatherCalendarService weatherCalendarService;

    @GetMapping
    public ApiResponse<WeatherCalendarResponse> current() {
        return ApiResponse.ok(weatherCalendarService.getSnapshot());
    }
}
