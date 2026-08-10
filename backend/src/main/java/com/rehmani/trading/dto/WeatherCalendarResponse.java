package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WeatherCalendarResponse {
    private String locationLabel;
    private Double latitude;
    private Double longitude;
    private String timezone;
    private Integer temperatureC;
    private Integer weatherCode;
    private String conditionEn;
    private String conditionUr;
    private Integer humidity;
    private Integer windKmh;
    private String gregorianDate;
    private HijriDateInfo hijri;
    private Boolean weatherAvailable;

    @Data
    @Builder
    public static class HijriDateInfo {
        private Integer day;
        private Integer month;
        private Integer year;
        private String monthNameEn;
        private String monthNameUr;
        private Integer adjustmentDays;
        private String formattedEn;
        private String formattedUr;
        private Boolean autoDaily;
    }
}
