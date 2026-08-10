package com.rehmani.trading.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "business_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_name", nullable = false)
    @Builder.Default
    private String companyName = "Rehmani Trading Company";

    @Column(name = "company_logo_url")
    private String companyLogoUrl;

    private String address;
    private String phone;
    private String email;

    /** Total commission % of amount (Arhat + Munshi + Workers). */
    @Column(name = "default_commission_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal defaultCommissionPercentage = new BigDecimal("4.00");

    /** Munshi/Nigran share as % of TOTAL amount (default 0.70). */
    @Column(name = "supervisor_share_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal supervisorSharePercentage = new BigDecimal("0.70");

    /** Workers share as % of TOTAL amount (default 0.30). */
    @Column(name = "labor_share_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal laborSharePercentage = new BigDecimal("0.30");

    /** Arhat share as % of TOTAL amount (default 3.00). */
    @Column(name = "arhat_share_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal arhatSharePercentage = new BigDecimal("3.00");

    @Column(name = "low_stock_threshold", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal lowStockThreshold = new BigDecimal("100.00");

    @Column(name = "backup_reminder_days", nullable = false)
    @Builder.Default
    private Integer backupReminderDays = 7;

    @Column(name = "payment_reminder_days", nullable = false)
    @Builder.Default
    private Integer paymentReminderDays = 3;

    /** Optional Gemini API key for pro-level AI assistant (owner-managed). */
    @Column(name = "gemini_api_key")
    private String geminiApiKey;

    /** Weather location for navbar / AI (default: Lahore grain market area). */
    @Column(name = "weather_latitude", nullable = false, precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal weatherLatitude = new BigDecimal("31.520400");

    @Column(name = "weather_longitude", nullable = false, precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal weatherLongitude = new BigDecimal("74.358700");

    @Column(name = "weather_location_label", nullable = false)
    @Builder.Default
    private String weatherLocationLabel = "Lahore";

    @Column(name = "weather_timezone", nullable = false)
    @Builder.Default
    private String weatherTimezone = "Asia/Karachi";

    /**
     * Days to shift Islamic date relative to algorithmic Umm al-Qura conversion.
     * Used when local moon-sighting differs; still advances automatically each day.
     */
    @Column(name = "hijri_adjustment_days", nullable = false)
    @Builder.Default
    private Integer hijriAdjustmentDays = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
