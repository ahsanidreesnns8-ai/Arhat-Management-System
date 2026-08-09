package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Buyer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BuyerRepository extends JpaRepository<Buyer, Long> {
    Optional<Buyer> findByBuyerIdAndDeletedFalse(String buyerId);
    Optional<Buyer> findByIdAndDeletedFalse(Long id);
    List<Buyer> findByDeletedFalseOrderByCreatedAtDesc();
    long countByDeletedFalse();

    @Query("SELECT b FROM Buyer b WHERE b.deleted = false AND (" +
           "LOWER(b.buyerId) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(b.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "b.cnic LIKE CONCAT('%', :query, '%') OR " +
           "b.phone LIKE CONCAT('%', :query, '%'))")
    List<Buyer> search(@Param("query") String query);

    @Query("SELECT MAX(CAST(SUBSTRING(b.buyerId, 4) AS int)) FROM Buyer b WHERE b.buyerId LIKE 'BYR%'")
    Integer findMaxBuyerNumber();
}
