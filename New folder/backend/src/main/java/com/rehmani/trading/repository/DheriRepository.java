package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Dheri;
import com.rehmani.trading.entity.SellingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DheriRepository extends JpaRepository<Dheri, Long> {
    Optional<Dheri> findByDheriIdAndDeletedFalse(String dheriId);
    Optional<Dheri> findByIdAndDeletedFalse(Long id);
    List<Dheri> findByDeletedFalseOrderByCreatedAtDesc();
    List<Dheri> findByFarmerIdAndDeletedFalse(Long farmerId);
    List<Dheri> findBySellingStatusAndDeletedFalse(SellingStatus status);

    @Query("SELECT d FROM Dheri d WHERE d.deleted = false AND (" +
           "LOWER(d.dheriId) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "CAST(d.queueNumber AS string) LIKE CONCAT('%', :query, '%'))")
    List<Dheri> search(@Param("query") String query);

    @Query("SELECT MAX(CAST(SUBSTRING(d.dheriId, 4) AS int)) FROM Dheri d WHERE d.dheriId LIKE 'DHR%'")
    Integer findMaxDheriNumber();
}
