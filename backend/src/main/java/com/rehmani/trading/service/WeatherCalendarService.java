package com.rehmani.trading.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rehmani.trading.dto.WeatherCalendarResponse;
import com.rehmani.trading.entity.BusinessSettings;
import com.rehmani.trading.repository.BusinessSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.chrono.HijrahChronology;
import java.time.chrono.HijrahDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoField;

@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherCalendarService {

    private static final String[] HIJRI_MONTHS_EN = {
            "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
            "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
            "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah"
    };
    private static final String[] HIJRI_MONTHS_UR = {
            "محرم", "صفر", "ربیع الاول", "ربیع الثانی",
            "جمادی الاول", "جمادی الثانی", "رجب", "شعبان",
            "رمضان", "شوال", "ذوالقعدہ", "ذوالحجہ"
    };

    private final BusinessSettingsRepository settingsRepository;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    private volatile CacheEntry cache;

    public void clearCache() {
        cache = null;
    }

    public WeatherCalendarResponse getSnapshot() {
        BusinessSettings settings = settingsRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Settings not found"));

        double lat = settings.getWeatherLatitude() != null
                ? settings.getWeatherLatitude().doubleValue() : 31.5204;
        double lon = settings.getWeatherLongitude() != null
                ? settings.getWeatherLongitude().doubleValue() : 74.3587;
        String label = settings.getWeatherLocationLabel() != null
                ? settings.getWeatherLocationLabel() : "Lahore";
        String tz = settings.getWeatherTimezone() != null
                ? settings.getWeatherTimezone() : "Asia/Karachi";
        int adjustment = settings.getHijriAdjustmentDays() != null
                ? settings.getHijriAdjustmentDays() : 0;

        WeatherParts weather = fetchWeather(lat, lon, tz);
        WeatherCalendarResponse.HijriDateInfo hijri = buildHijri(tz, adjustment);

        ZoneId zone = safeZone(tz);
        String gregorian = LocalDate.now(zone).format(DateTimeFormatter.ISO_LOCAL_DATE);

        return WeatherCalendarResponse.builder()
                .locationLabel(label)
                .latitude(lat)
                .longitude(lon)
                .timezone(tz)
                .temperatureC(weather.tempC())
                .weatherCode(weather.code())
                .conditionEn(weatherLabel(weather.code(), false))
                .conditionUr(weatherLabel(weather.code(), true))
                .humidity(weather.humidity())
                .windKmh(weather.windKmh())
                .gregorianDate(gregorian)
                .hijri(hijri)
                .weatherAvailable(weather.available())
                .build();
    }

    public int computeHijriAdjustment(int day, int month, int year, String timezone) {
        ZoneId zone = safeZone(timezone != null ? timezone : "Asia/Karachi");
        LocalDate today = LocalDate.now(zone);
        HijrahDate calculated = HijrahChronology.INSTANCE.date(today);
        HijrahDate target = HijrahChronology.INSTANCE.date(year, month, day);
        return (int) (target.toEpochDay() - calculated.toEpochDay());
    }

    private WeatherCalendarResponse.HijriDateInfo buildHijri(String timezone, int adjustmentDays) {
        ZoneId zone = safeZone(timezone);
        LocalDate today = LocalDate.now(zone);
        HijrahDate hijri = HijrahChronology.INSTANCE.date(today.plusDays(adjustmentDays));
        int day = hijri.get(ChronoField.DAY_OF_MONTH);
        int month = hijri.get(ChronoField.MONTH_OF_YEAR);
        int year = hijri.get(ChronoField.YEAR);
        String monthEn = HIJRI_MONTHS_EN[Math.max(0, Math.min(11, month - 1))];
        String monthUr = HIJRI_MONTHS_UR[Math.max(0, Math.min(11, month - 1))];
        return WeatherCalendarResponse.HijriDateInfo.builder()
                .day(day)
                .month(month)
                .year(year)
                .monthNameEn(monthEn)
                .monthNameUr(monthUr)
                .adjustmentDays(adjustmentDays)
                .formattedEn(day + " " + monthEn + " " + year + " AH")
                .formattedUr(toUrduDigits(day) + " " + monthUr + " " + toUrduDigits(year) + " ھ")
                .autoDaily(adjustmentDays == 0)
                .build();
    }

    private WeatherParts fetchWeather(double lat, double lon, String timezone) {
        long now = System.currentTimeMillis();
        CacheEntry local = cache;
        String key = lat + "|" + lon + "|" + timezone;
        if (local != null && key.equals(local.key()) && local.expiresAt() > now) {
            return local.parts();
        }
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", lat)
                    .queryParam("longitude", lon)
                    .queryParam("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m")
                    .queryParam("timezone", timezone)
                    .toUriString();
            JsonNode cur = objectMapper.readTree(
                    restClientBuilder.build().get().uri(url).retrieve().body(String.class)).path("current");
            WeatherParts parts = new WeatherParts(
                    true,
                    (int) Math.round(cur.path("temperature_2m").asDouble()),
                    cur.path("weather_code").asInt(0),
                    cur.path("relative_humidity_2m").asInt(0),
                    (int) Math.round(cur.path("wind_speed_10m").asDouble())
            );
            cache = new CacheEntry(key, parts, now + 10 * 60 * 1000L);
            return parts;
        } catch (Exception ex) {
            log.warn("Weather fetch failed: {}", ex.getMessage());
            if (local != null && key.equals(local.key())) {
                return local.parts();
            }
            return new WeatherParts(false, null, 0, null, null);
        }
    }

    private static ZoneId safeZone(String tz) {
        try {
            return ZoneId.of(tz);
        } catch (Exception ex) {
            return ZoneId.of("Asia/Karachi");
        }
    }

    private static String weatherLabel(int code, boolean urdu) {
        if (code == 0) return urdu ? "صاف" : "Clear";
        if (code <= 2) return urdu ? "جزوی ابر" : "Partly cloudy";
        if (code <= 48) return urdu ? "ابر آلود" : "Cloudy";
        if (code <= 67 || (code >= 80 && code <= 82)) return urdu ? "بارش" : "Rain";
        if (code >= 71 && code <= 77) return urdu ? "برف" : "Snow";
        return urdu ? "ہوا" : "Windy";
    }

    private static String toUrduDigits(int n) {
        String s = String.valueOf(n);
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c >= '0' && c <= '9') sb.append((char) ('۰' + (c - '0')));
            else sb.append(c);
        }
        return sb.toString();
    }

    private record WeatherParts(boolean available, Integer tempC, int code, Integer humidity, Integer windKmh) {}
    private record CacheEntry(String key, WeatherParts parts, long expiresAt) {}
}
