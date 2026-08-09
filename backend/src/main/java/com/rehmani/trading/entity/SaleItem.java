package com.rehmani.trading.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "sale_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false)
    private SaleSourceType sourceType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "farmer_id")
    private Farmer farmer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dheri_id")
    private Dheri dheri;

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

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal rate = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal amount = BigDecimal.ZERO;
}
