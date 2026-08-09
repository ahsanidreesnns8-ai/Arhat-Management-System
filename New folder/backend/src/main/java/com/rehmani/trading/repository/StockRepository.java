package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface StockRepository extends JpaRepository<Stock, Long> {
    Optional<Stock> findByProductId(Long productId);

    @Query("SELECT COALESCE(SUM(s.quantity), 0) FROM Stock s")
    BigDecimal getTotalStockQuantity();

    List<Stock> findByLowStockAlertTrue();
}
