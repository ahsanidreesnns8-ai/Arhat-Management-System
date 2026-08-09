package com.rehmani.trading.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rehmani.trading.dto.BackupData;
import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class BackupService {

    private final BusinessSettingsRepository settingsRepository;
    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final ProductRepository productRepository;
    private final StockRepository stockRepository;
    private final SaleRepository saleRepository;
    private final DheriRepository dheriRepository;
    private final ObjectMapper objectMapper;

    public byte[] exportZip() {
        BackupData data = buildBackupData();
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zos = new ZipOutputStream(baos)) {
            writeZipEntry(zos, "backup.json", objectMapper.writeValueAsBytes(data));
            zos.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to export backup", e);
        }
    }

    public BackupData exportJson() {
        return buildBackupData();
    }

    @Transactional
    public void restore(BackupData data) {
        if (data.getSettings() != null) {
            restoreSettings(data.getSettings());
        }
        if (data.getProducts() != null) {
            restoreProducts(data.getProducts());
        }
        if (data.getFarmers() != null) {
            restoreFarmers(data.getFarmers());
        }
        if (data.getBuyers() != null) {
            restoreBuyers(data.getBuyers());
        }
        if (data.getStock() != null) {
            restoreStock(data.getStock());
        }
    }

    private BackupData buildBackupData() {
        BusinessSettings settings = settingsRepository.findAll().stream().findFirst().orElse(null);

        return BackupData.builder()
                .settings(settings != null ? toMap(settings) : Map.of())
                .farmers(farmerRepository.findByDeletedFalseOrderByCreatedAtDesc().stream().map(this::toMap).toList())
                .buyers(buyerRepository.findByDeletedFalseOrderByCreatedAtDesc().stream().map(this::toMap).toList())
                .products(productRepository.findByDeletedFalseAndActiveTrueOrderByNameAsc().stream().map(this::toMap).toList())
                .stock(stockRepository.findAllWithProduct().stream().map(this::toMap).toList())
                .sales(saleRepository.findByDeletedFalseOrderBySaleDateDescCreatedAtDesc().stream().map(this::toMap).toList())
                .dheris(dheriRepository.findByDeletedFalseOrderByCreatedAtDesc().stream().map(this::toMap).toList())
                .build();
    }

    private void restoreSettings(Map<String, Object> map) {
        BusinessSettings settings = settingsRepository.findAll().stream().findFirst()
                .orElse(BusinessSettings.builder().build());
        if (map.get("companyName") != null) settings.setCompanyName((String) map.get("companyName"));
        if (map.get("address") != null) settings.setAddress((String) map.get("address"));
        if (map.get("phone") != null) settings.setPhone((String) map.get("phone"));
        if (map.get("email") != null) settings.setEmail((String) map.get("email"));
        settingsRepository.save(settings);
    }

    private void restoreProducts(List<Map<String, Object>> items) {
        for (Map<String, Object> map : items) {
            String code = (String) map.get("productCode");
            Product product = productRepository.findAll().stream()
                    .filter(p -> code != null && code.equals(p.getProductCode()))
                    .findFirst()
                    .orElse(Product.builder().productCode(code).build());
            product.setName((String) map.getOrDefault("name", product.getName()));
            product.setActive(true);
            product.setDeleted(false);
            productRepository.save(product);
        }
    }

    private void restoreFarmers(List<Map<String, Object>> items) {
        for (Map<String, Object> map : items) {
            String farmerId = (String) map.get("farmerId");
            Farmer farmer = farmerRepository.findByFarmerIdAndDeletedFalse(farmerId)
                    .orElse(Farmer.builder().farmerId(farmerId).build());
            farmer.setName((String) map.getOrDefault("name", farmer.getName()));
            farmer.setPhone((String) map.get("phone"));
            farmer.setAddress((String) map.get("address"));
            farmer.setCity((String) map.get("city"));
            farmer.setDeleted(false);
            farmer.setActive(true);
            farmerRepository.save(farmer);
        }
    }

    private void restoreBuyers(List<Map<String, Object>> items) {
        for (Map<String, Object> map : items) {
            String buyerId = (String) map.get("buyerId");
            Buyer buyer = buyerRepository.findByBuyerIdAndDeletedFalse(buyerId)
                    .orElse(Buyer.builder().buyerId(buyerId).build());
            buyer.setName((String) map.getOrDefault("name", buyer.getName()));
            buyer.setPhone((String) map.get("phone"));
            buyer.setAddress((String) map.get("address"));
            buyer.setCity((String) map.get("city"));
            buyer.setDeleted(false);
            buyer.setActive(true);
            buyerRepository.save(buyer);
        }
    }

    private void restoreStock(List<Map<String, Object>> items) {
        for (Map<String, Object> map : items) {
            Long productId = map.get("productId") != null ? ((Number) map.get("productId")).longValue() : null;
            if (productId == null) continue;
            Product product = productRepository.findById(productId).orElse(null);
            if (product == null) continue;
            Stock stock = stockRepository.findByProductId(productId)
                    .orElse(Stock.builder().product(product).build());
            if (map.get("quantity") != null) {
                stock.setQuantity(new java.math.BigDecimal(map.get("quantity").toString()));
            }
            stockRepository.save(stock);
        }
    }

    private void writeZipEntry(ZipOutputStream zos, String name, byte[] data) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        zos.putNextEntry(entry);
        zos.write(data);
        zos.closeEntry();
    }

    private Map<String, Object> toMap(BusinessSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("companyName", s.getCompanyName());
        m.put("address", s.getAddress());
        m.put("phone", s.getPhone());
        m.put("email", s.getEmail());
        m.put("defaultCommissionPercentage", s.getDefaultCommissionPercentage());
        return m;
    }

    private Map<String, Object> toMap(Farmer f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", f.getId());
        m.put("farmerId", f.getFarmerId());
        m.put("name", f.getName());
        m.put("phone", f.getPhone());
        m.put("address", f.getAddress());
        m.put("city", f.getCity());
        return m;
    }

    private Map<String, Object> toMap(Buyer b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("buyerId", b.getBuyerId());
        m.put("name", b.getName());
        m.put("phone", b.getPhone());
        m.put("address", b.getAddress());
        m.put("city", b.getCity());
        return m;
    }

    private Map<String, Object> toMap(Product p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("productCode", p.getProductCode());
        m.put("name", p.getName());
        return m;
    }

    private Map<String, Object> toMap(Stock s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("productId", s.getProduct().getId());
        m.put("productCode", s.getProduct().getProductCode());
        m.put("quantity", s.getQuantity());
        return m;
    }

    private Map<String, Object> toMap(Sale s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("invoiceNumber", s.getInvoiceNumber());
        m.put("buyerId", s.getBuyer() != null ? s.getBuyer().getId() : null);
        m.put("saleDate", s.getSaleDate() != null ? s.getSaleDate().toString() : null);
        m.put("totalAmount", s.getTotalAmount());
        m.put("paidAmount", s.getPaidAmount());
        return m;
    }

    private Map<String, Object> toMap(Dheri d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId());
        m.put("dheriId", d.getDheriId());
        m.put("farmerId", d.getFarmer() != null ? d.getFarmer().getId() : null);
        m.put("totalPrice", d.getTotalPrice());
        m.put("commissionAmount", d.getCommissionAmount());
        return m;
    }
}
