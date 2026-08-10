package com.rehmani.trading.service;

import com.rehmani.trading.dto.SaleItemRequest;
import com.rehmani.trading.dto.SaleItemResponse;
import com.rehmani.trading.dto.SaleRequest;
import com.rehmani.trading.dto.SaleResponse;
import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SaleService {

    private static final BigDecimal MANN_WEIGHT = new BigDecimal("40");

    private final SaleRepository saleRepository;
    private final BuyerRepository buyerRepository;
    private final FarmerRepository farmerRepository;
    private final DheriRepository dheriRepository;
    private final ProductRepository productRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final StockService stockService;
    private final AuditService auditService;

    public List<SaleResponse> getAll() {
        return saleRepository.findByDeletedFalseOrderBySaleDateDescCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public SaleResponse getById(Long id) {
        Sale sale = saleRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Sale not found"));
        return toResponse(sale);
    }

    public List<SaleResponse> getByBuyer(Long buyerId) {
        buyerRepository.findByIdAndDeletedFalse(buyerId)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        return saleRepository.findByBuyerIdWithItems(buyerId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public SaleResponse create(SaleRequest request) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(request.getBuyerId())
                .orElseThrow(() -> new RuntimeException("Buyer not found"));

        Sale sale = Sale.builder()
                .invoiceNumber(generateInvoiceNumber())
                .buyer(buyer)
                .saleDate(request.getSaleDate() != null ? request.getSaleDate() : LocalDate.now())
                .notes(request.getNotes())
                .createdBy(resolveCurrentUser())
                .items(new ArrayList<>())
                .build();

        int totalBags = 0;
        BigDecimal totalWeight = BigDecimal.ZERO;
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<SaleItem> businessStockItems = new ArrayList<>();

        for (SaleItemRequest itemRequest : request.getItems()) {
            SaleItem item = buildSaleItem(sale, itemRequest);
            sale.getItems().add(item);

            totalBags += item.getNumberOfBags();
            totalWeight = totalWeight.add(item.getTotalWeight());
            totalAmount = totalAmount.add(item.getAmount());

            if (item.getSourceType() == SaleSourceType.FARMER) {
                processFarmerItem(item);
            } else if (item.getSourceType() == SaleSourceType.BUSINESS_STOCK) {
                businessStockItems.add(item);
            }
        }

        BigDecimal paidAmount = defaultZero(request.getPaidAmount());
        if (paidAmount.compareTo(totalAmount) > 0) {
            throw new RuntimeException("Paid amount cannot exceed total amount");
        }

        sale.setTotalBags(totalBags);
        sale.setTotalWeight(totalWeight);
        sale.setTotalAmount(totalAmount);
        sale.setPaidAmount(paidAmount);
        sale.setPaymentStatus(determinePaymentStatus(totalAmount, paidAmount));

        BigDecimal unpaid = totalAmount.subtract(paidAmount);
        if (unpaid.compareTo(BigDecimal.ZERO) > 0) {
            buyer.setOutstandingBalance(buyer.getOutstandingBalance().add(unpaid));
            buyerRepository.save(buyer);
        }

        Sale saved = saleRepository.save(sale);

        for (SaleItem item : businessStockItems) {
            stockService.decrementForSale(
                    item.getProduct().getId(),
                    item.getTotalWeight(),
                    saved.getId(),
                    "Sale " + saved.getInvoiceNumber()
            );
        }

        if (paidAmount.compareTo(BigDecimal.ZERO) > 0) {
            createBuyerPayment(saved, buyer, paidAmount);
        }

        auditService.log(
                saved.getCreatedBy() != null ? saved.getCreatedBy().getId() : null,
                "CREATE",
                "Sale",
                saved.getId(),
                null,
                saved.getInvoiceNumber()
        );

        return toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        Sale sale = saleRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Sale not found"));

        Buyer buyer = sale.getBuyer();
        BigDecimal unpaid = sale.getTotalAmount().subtract(sale.getPaidAmount());
        if (unpaid.compareTo(BigDecimal.ZERO) > 0) {
            buyer.setOutstandingBalance(buyer.getOutstandingBalance().subtract(unpaid));
            buyerRepository.save(buyer);
        }

        for (SaleItem item : sale.getItems()) {
            if (item.getSourceType() == SaleSourceType.FARMER && item.getFarmer() != null) {
                reverseFarmerItem(item);
            } else if (item.getSourceType() == SaleSourceType.BUSINESS_STOCK) {
                stockService.incrementForIncoming(
                        item.getProduct().getId(),
                        item.getTotalWeight(),
                        sale.getId(),
                        "Sale deleted: " + sale.getInvoiceNumber()
                );
            }
        }

        sale.setDeleted(true);
        saleRepository.save(sale);

        auditService.log(
                resolveCurrentUser() != null ? resolveCurrentUser().getId() : null,
                "DELETE",
                "Sale",
                sale.getId(),
                sale.getInvoiceNumber(),
                null
        );
    }

    private SaleItem buildSaleItem(Sale sale, SaleItemRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        SaleSourceType sourceType = parseSourceType(request.getSourceType());
        int bags = request.getNumberOfBags() != null ? request.getNumberOfBags() : 0;
        BigDecimal weightPerBag = defaultIfNull(request.getWeightPerBag(), MANN_WEIGHT);
        BigDecimal partialBagWeight = defaultIfNull(request.getPartialBagWeight(), BigDecimal.ZERO);
        BigDecimal rate = defaultIfNull(request.getRate(), BigDecimal.ZERO);

        BigDecimal itemTotalWeight = weightPerBag.multiply(BigDecimal.valueOf(bags))
                .add(partialBagWeight)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal amount = itemTotalWeight.divide(MANN_WEIGHT, 4, RoundingMode.HALF_UP)
                .multiply(rate)
                .setScale(2, RoundingMode.HALF_UP);

        SaleItem.SaleItemBuilder builder = SaleItem.builder()
                .sale(sale)
                .product(product)
                .sourceType(sourceType)
                .numberOfBags(bags)
                .weightPerBag(weightPerBag)
                .partialBagWeight(partialBagWeight)
                .totalWeight(itemTotalWeight)
                .rate(rate)
                .amount(amount);

        if (sourceType == SaleSourceType.FARMER) {
            if (request.getFarmerId() == null) {
                throw new RuntimeException("Farmer ID is required for farmer-sourced items");
            }
            Farmer farmer = farmerRepository.findByIdAndDeletedFalse(request.getFarmerId())
                    .orElseThrow(() -> new RuntimeException("Farmer not found"));
            builder.farmer(farmer);

            if (request.getDheriId() != null) {
                Dheri dheri = dheriRepository.findByIdAndDeletedFalse(request.getDheriId())
                        .orElseThrow(() -> new RuntimeException("Dheri not found"));
                builder.dheri(dheri);
            }
        }

        return builder.build();
    }

    private void processFarmerItem(SaleItem item) {
        Farmer farmer = item.getFarmer();
        BigDecimal farmerAmount = item.getAmount();
        boolean alreadyPosted = false;

        if (item.getDheri() != null) {
            Dheri dheri = item.getDheri();
            if (dheri.getFarmerReceivable() != null && dheri.getFarmerReceivable().compareTo(BigDecimal.ZERO) > 0) {
                farmerAmount = dheri.getFarmerReceivable();
            }
            alreadyPosted = Boolean.TRUE.equals(dheri.getPayablePosted());

            if (item.getTotalWeight().compareTo(dheri.getTotalWeight()) >= 0) {
                dheri.setSellingStatus(SellingStatus.SOLD);
            } else {
                dheri.setSellingStatus(SellingStatus.SELLING);
            }
            if (!alreadyPosted && farmerAmount.compareTo(BigDecimal.ZERO) > 0) {
                dheri.setPayablePosted(true);
            }
            dheriRepository.save(dheri);
        }

        // Avoid double-counting when Arhat settlement already posted farmer payable
        if (!alreadyPosted) {
            farmer.setOutstandingBalance(farmer.getOutstandingBalance().add(farmerAmount));
            farmerRepository.save(farmer);
        }
    }

    private void reverseFarmerItem(SaleItem item) {
        Farmer farmer = item.getFarmer();
        BigDecimal farmerAmount = item.getAmount();

        if (item.getDheri() != null) {
            Dheri dheri = item.getDheri();
            if (dheri.getFarmerReceivable() != null && dheri.getFarmerReceivable().compareTo(BigDecimal.ZERO) > 0) {
                farmerAmount = dheri.getFarmerReceivable();
            }
            dheri.setSellingStatus(SellingStatus.PENDING);
            dheriRepository.save(dheri);
        }

        farmer.setOutstandingBalance(farmer.getOutstandingBalance().subtract(farmerAmount));
        farmerRepository.save(farmer);
    }

    private void createBuyerPayment(Sale sale, Buyer buyer, BigDecimal amount) {
        Payment payment = Payment.builder()
                .paymentType(PaymentType.BUYER)
                .buyer(buyer)
                .sale(sale)
                .amount(amount)
                .paymentMethod(PaymentMethod.CASH)
                .paymentDate(sale.getSaleDate())
                .notes("Initial payment on sale " + sale.getInvoiceNumber())
                .createdBy(sale.getCreatedBy())
                .build();
        paymentRepository.save(payment);
    }

    private String generateInvoiceNumber() {
        Integer max = saleRepository.findMaxInvoiceNumber();
        int next = (max != null ? max : 0) + 1;
        return String.format("INV-%05d", next);
    }

    private PaymentStatus determinePaymentStatus(BigDecimal totalAmount, BigDecimal paidAmount) {
        if (paidAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return PaymentStatus.PENDING;
        }
        if (paidAmount.compareTo(totalAmount) >= 0) {
            return PaymentStatus.PAID;
        }
        return PaymentStatus.PARTIAL;
    }

    private SaleSourceType parseSourceType(String sourceType) {
        try {
            return SaleSourceType.valueOf(sourceType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid source type: " + sourceType);
        }
    }

    private User resolveCurrentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        return userRepository.findByUsernameAndDeletedFalse(auth.getName()).orElse(null);
    }

    private BigDecimal defaultZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private BigDecimal defaultIfNull(BigDecimal value, BigDecimal defaultValue) {
        return value != null ? value : defaultValue;
    }

    SaleResponse toResponse(Sale sale) {
        var items = sale.getItems() != null ? sale.getItems() : java.util.List.<com.rehmani.trading.entity.SaleItem>of();
        return SaleResponse.builder()
                .id(sale.getId())
                .invoiceNumber(sale.getInvoiceNumber())
                .buyerId(sale.getBuyer() != null ? sale.getBuyer().getId() : null)
                .buyerName(sale.getBuyer() != null ? sale.getBuyer().getName() : null)
                .buyerCode(sale.getBuyer() != null ? sale.getBuyer().getBuyerId() : null)
                .saleDate(sale.getSaleDate())
                .totalBags(sale.getTotalBags())
                .totalWeight(defaultZero(sale.getTotalWeight()))
                .totalAmount(defaultZero(sale.getTotalAmount()))
                .paidAmount(defaultZero(sale.getPaidAmount()))
                .paymentStatus(sale.getPaymentStatus() != null ? sale.getPaymentStatus().name() : "UNPAID")
                .notes(sale.getNotes())
                .createdAt(sale.getCreatedAt())
                .items(items.stream().map(this::toItemResponse).toList())
                .build();
    }

    private SaleItemResponse toItemResponse(SaleItem item) {
        return SaleItemResponse.builder()
                .id(item.getId())
                .productId(item.getProduct().getId())
                .productName(item.getProduct().getName())
                .sourceType(item.getSourceType().name())
                .farmerId(item.getFarmer() != null ? item.getFarmer().getId() : null)
                .farmerName(item.getFarmer() != null ? item.getFarmer().getName() : null)
                .dheriId(item.getDheri() != null ? item.getDheri().getId() : null)
                .dheriCode(item.getDheri() != null ? item.getDheri().getDheriId() : null)
                .numberOfBags(item.getNumberOfBags())
                .weightPerBag(item.getWeightPerBag())
                .partialBagWeight(item.getPartialBagWeight())
                .totalWeight(item.getTotalWeight())
                .rate(item.getRate())
                .amount(item.getAmount())
                .build();
    }
}
