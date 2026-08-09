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

    @Column(name = "default_commission_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal defaultCommissionPercentage = new BigDecimal("2.00");

    @Column(name = "supervisor_share_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal supervisorSharePercentage = new BigDecimal("40.00");

    @Column(name = "labor_share_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal laborSharePercentage = new BigDecimal("30.00");

    @Column(name = "arhat_share_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal arhatSharePercentage = new BigDecimal("30.00");

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

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
