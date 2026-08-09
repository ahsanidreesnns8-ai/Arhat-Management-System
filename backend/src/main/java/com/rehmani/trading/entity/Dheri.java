package com.rehmani.trading.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "dheris")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Dheri {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dheri_id", nullable = false, unique = true, length = 20)
    private String dheriId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "farmer_id", nullable = false)
    private Farmer farmer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "truck_id")
    private Truck truck;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "queue_number")
    private Integer queueNumber;

    @Column(name = "number_of_bags", nullable = false)
    @Builder.Default
    private Integer numberOfBags = 0;

    @Column(name = "weight_per_bag", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal weightPerBag = new BigDecimal("40.00");

    @Column(name = "partial_bag_weight", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal partialBagWeight = BigDecimal.ZERO;

    @Column(name = "total_weight", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal totalWeight = BigDecimal.ZERO;

    @Column(name = "market_rate", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal marketRate = BigDecimal.ZERO;

    @Column(name = "commission_percentage", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal commissionPercentage = new BigDecimal("2.00");

    @Column(name = "total_price", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalPrice = BigDecimal.ZERO;

    @Column(name = "commission_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal commissionAmount = BigDecimal.ZERO;

    @Column(name = "farmer_receivable", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal farmerReceivable = BigDecimal.ZERO;

    @Column(name = "supervisor_share", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal supervisorShare = BigDecimal.ZERO;

    @Column(name = "labor_share", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal laborShare = BigDecimal.ZERO;

    @Column(name = "arhat_share", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal arhatShare = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "selling_status", nullable = false)
    @Builder.Default
    private SellingStatus sellingStatus = SellingStatus.PENDING;

    private String notes;

    @Column(nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
