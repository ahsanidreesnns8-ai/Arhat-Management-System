package com.rehmani.trading.service;

import com.rehmani.trading.dto.StockAdjustmentRequest;
import com.rehmani.trading.dto.StockResponse;
import com.rehmani.trading.dto.StockTransactionResponse;
import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.BusinessSettingsRepository;
import com.rehmani.trading.repository.ProductRepository;
import com.rehmani.trading.repository.StockRepository;
import com.rehmani.trading.repository.StockTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StockService {

    private final StockRepository stockRepository;
    private final StockTransactionRepository stockTransactionRepository;
    private final ProductRepository productRepository;
    private final BusinessSettingsRepository settingsRepository;

    public List<StockResponse> getAll() {
        return stockRepository.findAll().stream().map(this::toResponse).toList();
    }

    public List<StockTransactionResponse> getHistory() {
        return stockTransactionRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toTransactionResponse).toList();
    }

    @Transactional
    public StockResponse adjust(StockAdjustmentRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        Stock stock = stockRepository.findByProductId(product.getId())
                .orElseGet(() -> Stock.builder().product(product).quantity(BigDecimal.ZERO).build());

        BigDecimal previous = stock.getQuantity();
        StockTransactionType type = parseType(request.getType());
        BigDecimal newQty = calculateNewQuantity(previous, request.getQuantity(), type);

        stock.setQuantity(newQty);
        updateLowStockAlert(stock);
        stockRepository.save(stock);

        StockTransaction tx = StockTransaction.builder()
                .product(product)
                .transactionType(type)
                .quantity(request.getQuantity())
                .previousQuantity(previous)
                .newQuantity(newQty)
                .notes(request.getNotes())
                .referenceType("MANUAL")
                .build();
        stockTransactionRepository.save(tx);

        return toResponse(stock);
    }

    private BigDecimal calculateNewQuantity(BigDecimal previous, BigDecimal qty, StockTransactionType type) {
        return switch (type) {
            case INCOMING -> previous.add(qty);
            case OUTGOING, SALE -> previous.subtract(qty);
            case ADJUSTMENT, TRANSFER -> qty;
        };
    }

    private StockTransactionType parseType(String type) {
        if (type == null) return StockTransactionType.ADJUSTMENT;
        try {
            return StockTransactionType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return StockTransactionType.ADJUSTMENT;
        }
    }

    private void updateLowStockAlert(Stock stock) {
        var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
        BigDecimal threshold = settings != null ? settings.getLowStockThreshold() : new BigDecimal("100");
        stock.setLowStockAlert(stock.getQuantity().compareTo(threshold) < 0);
    }

    private StockResponse toResponse(Stock stock) {
        return StockResponse.builder()
                .id(stock.getId())
                .productId(stock.getProduct().getId())
                .productCode(stock.getProduct().getProductCode())
                .productName(stock.getProduct().getName())
                .quantity(stock.getQuantity())
                .lowStockAlert(stock.getLowStockAlert())
                .build();
    }

    private StockTransactionResponse toTransactionResponse(StockTransaction tx) {
        return StockTransactionResponse.builder()
                .id(tx.getId())
                .productId(tx.getProduct().getId())
                .productName(tx.getProduct().getName())
                .transactionType(tx.getTransactionType().name())
                .quantity(tx.getQuantity())
                .previousQuantity(tx.getPreviousQuantity())
                .newQuantity(tx.getNewQuantity())
                .notes(tx.getNotes())
                .createdAt(tx.getCreatedAt())
                .build();
    }
}
