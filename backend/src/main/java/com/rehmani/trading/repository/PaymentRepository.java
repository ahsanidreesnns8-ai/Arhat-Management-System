package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByFarmerIdOrderByPaymentDateDesc(Long farmerId);
    List<Payment> findByBuyerIdOrderByPaymentDateDesc(Long buyerId);
    List<Payment> findAllByOrderByPaymentDateDescCreatedAtDesc();

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.farmer.id = :farmerId")
    BigDecimal getTotalPaidToFarmer(@Param("farmerId") Long farmerId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.buyer.id = :buyerId")
    BigDecimal getTotalPaidByBuyer(@Param("buyerId") Long buyerId);
}
