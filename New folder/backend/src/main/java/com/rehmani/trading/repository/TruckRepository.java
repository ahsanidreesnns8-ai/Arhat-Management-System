package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Truck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TruckRepository extends JpaRepository<Truck, Long> {
    Optional<Truck> findByTruckIdAndDeletedFalse(String truckId);
    Optional<Truck> findByIdAndDeletedFalse(Long id);
    List<Truck> findByDeletedFalseOrderByCreatedAtDesc();
    List<Truck> findByFarmerIdAndDeletedFalse(Long farmerId);

    @Query("SELECT t FROM Truck t WHERE t.deleted = false AND (" +
           "LOWER(t.truckId) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(t.registrationNumber) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Truck> search(@Param("query") String query);

    @Query("SELECT MAX(CAST(SUBSTRING(t.truckId, 4) AS int)) FROM Truck t WHERE t.truckId LIKE 'TRK%'")
    Integer findMaxTruckNumber();
}
