package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByIdAndDeletedFalse(Long id);
    List<Product> findByDeletedFalseAndActiveTrueOrderByNameAsc();

    @Query("SELECT p FROM Product p WHERE p.deleted = false AND LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Product> search(@Param("query") String query);
}
