package com.rehmani.trading.repository;

import com.rehmani.trading.entity.Sale;
import com.rehmani.trading.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SaleRepository extends JpaRepository<Sale, Long> {
    Optional<Sale> findByInvoiceNumberAndDeletedFalse(String invoiceNumber);
    Optional<Sale> findByIdAndDeletedFalse(Long id);
    List<Sale> findByDeletedFalseOrderBySaleDateDescCreatedAtDesc();
    List<Sale> findByBuyerIdAndDeletedFalseOrderBySaleDateDescCreatedAtDesc(Long buyerId);

    @Query("SELECT s FROM Sale s WHERE s.deleted = false AND s.saleDate = :date")
    List<Sale> findBySaleDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(s.totalAmount), 0) FROM Sale s WHERE s.deleted = false AND s.saleDate = :date")
    BigDecimal getTotalSalesByDate(@Param("date") LocalDate date);

    @Query("SELECT s FROM Sale s WHERE s.deleted = false AND LOWER(s.invoiceNumber) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Sale> search(@Param("query") String query);

    @Query("SELECT MAX(CAST(SUBSTRING(s.invoiceNumber, 5) AS int)) FROM Sale s WHERE s.invoiceNumber LIKE 'INV-%'")
    Integer findMaxInvoiceNumber();

    @Query("SELECT s FROM Sale s WHERE s.deleted = false AND s.saleDate BETWEEN :from AND :to ORDER BY s.saleDate DESC")
    List<Sale> findByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT s FROM Sale s JOIN FETCH s.buyer WHERE s.deleted = false AND s.buyer.id = :buyerId ORDER BY s.saleDate DESC")
    List<Sale> findByBuyerId(@Param("buyerId") Long buyerId);

    @Query("SELECT DISTINCT s FROM Sale s JOIN FETCH s.buyer LEFT JOIN FETCH s.items i LEFT JOIN FETCH i.product LEFT JOIN FETCH i.dheri LEFT JOIN FETCH i.farmer WHERE s.deleted = false AND s.buyer.id = :buyerId ORDER BY s.saleDate DESC, s.id DESC")
    List<Sale> findByBuyerIdWithItems(@Param("buyerId") Long buyerId);

    @Query("SELECT DISTINCT s FROM Sale s JOIN FETCH s.buyer LEFT JOIN FETCH s.items i LEFT JOIN FETCH i.product LEFT JOIN FETCH i.farmer WHERE s.deleted = false AND s.id = :id")
    java.util.Optional<Sale> findByIdWithDetails(@Param("id") Long id);
}
