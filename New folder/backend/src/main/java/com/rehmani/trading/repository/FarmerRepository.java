package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Farmer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FarmerRepository extends JpaRepository<Farmer, Long> {
    Optional<Farmer> findByFarmerIdAndDeletedFalse(String farmerId);
    Optional<Farmer> findByIdAndDeletedFalse(Long id);
    List<Farmer> findByDeletedFalseOrderByCreatedAtDesc();
    long countByDeletedFalse();

    @Query("SELECT f FROM Farmer f WHERE f.deleted = false AND (" +
           "LOWER(f.farmerId) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(f.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "f.cnic LIKE CONCAT('%', :query, '%') OR " +
           "f.phone LIKE CONCAT('%', :query, '%'))")
    List<Farmer> search(@Param("query") String query);

    @Query("SELECT MAX(CAST(SUBSTRING(f.farmerId, 4) AS int)) FROM Farmer f WHERE f.farmerId LIKE 'FRM%'")
    Integer findMaxFarmerNumber();
}
