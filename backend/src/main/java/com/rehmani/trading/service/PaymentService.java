package com.rehmani.trading.service;

import com.rehmani.trading.dto.PaymentRequest;
import com.rehmani.trading.dto.PaymentResponse;
import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final SaleRepository saleRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public List<PaymentResponse> getAll() {
        return paymentRepository.findAllByOrderByPaymentDateDescCreatedAtDesc()
                .stream().map(this::toResponse).toList();
    }

    public List<PaymentResponse> getByFarmer(Long farmerId) {
        return paymentRepository.findByFarmerIdOrderByPaymentDateDesc(farmerId)
                .stream().map(this::toResponse).toList();
    }

    public List<PaymentResponse> getByBuyer(Long buyerId) {
        return paymentRepository.findByBuyerIdOrderByPaymentDateDesc(buyerId)
                .stream().map(this::toResponse).toList();
    }

    public PaymentResponse getById(Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Payment not found"));
        return toResponse(payment);
    }

    @Transactional
    public PaymentResponse record(PaymentRequest request) {
        PaymentType paymentType = parsePaymentType(request.getPaymentType());
        BigDecimal amount = request.getAmount();

        Payment payment = Payment.builder()
                .paymentType(paymentType)
                .amount(amount)
                .paymentMethod(parsePaymentMethod(request.getPaymentMethod()))
                .paymentDate(request.getPaymentDate() != null ? request.getPaymentDate() : LocalDate.now())
                .referenceNumber(request.getReferenceNumber())
                .notes(request.getNotes())
                .createdBy(resolveCurrentUser())
                .build();

        if (paymentType == PaymentType.FARMER) {
            if (request.getFarmerId() == null) {
                throw new RuntimeException("Farmer ID is required for farmer payments");
            }
            Farmer farmer = farmerRepository.findByIdAndDeletedFalse(request.getFarmerId())
                    .orElseThrow(() -> new RuntimeException("Farmer not found"));
            payment.setFarmer(farmer);
            farmer.setOutstandingBalance(farmer.getOutstandingBalance().subtract(amount));
            farmerRepository.save(farmer);
        } else {
            if (request.getBuyerId() == null) {
                throw new RuntimeException("Buyer ID is required for buyer payments");
            }
            Buyer buyer = buyerRepository.findByIdAndDeletedFalse(request.getBuyerId())
                    .orElseThrow(() -> new RuntimeException("Buyer not found"));
            payment.setBuyer(buyer);
            buyer.setOutstandingBalance(buyer.getOutstandingBalance().subtract(amount));
            buyerRepository.save(buyer);

            if (request.getSaleId() != null) {
                Sale sale = saleRepository.findByIdAndDeletedFalse(request.getSaleId())
                        .orElseThrow(() -> new RuntimeException("Sale not found"));
                BigDecimal newPaidAmount = sale.getPaidAmount().add(amount);
                sale.setPaidAmount(newPaidAmount);
                sale.setPaymentStatus(determinePaymentStatus(sale.getTotalAmount(), newPaidAmount));
                saleRepository.save(sale);
                payment.setSale(sale);
            }
        }

        Payment saved = paymentRepository.save(payment);
        auditService.log(
                saved.getCreatedBy() != null ? saved.getCreatedBy().getId() : null,
                "CREATE",
                "Payment",
                saved.getId(),
                null,
                saved.getAmount().toPlainString()
        );
        return toResponse(saved);
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

    private PaymentType parsePaymentType(String type) {
        try {
            return PaymentType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid payment type: " + type);
        }
    }

    private PaymentMethod parsePaymentMethod(String method) {
        if (method == null) {
            return PaymentMethod.CASH;
        }
        try {
            return PaymentMethod.valueOf(method.toUpperCase());
        } catch (IllegalArgumentException e) {
            return PaymentMethod.CASH;
        }
    }

    private User resolveCurrentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        return userRepository.findByUsernameAndDeletedFalse(auth.getName()).orElse(null);
    }

    PaymentResponse toResponse(Payment payment) {
        return PaymentResponse.builder()
                .id(payment.getId())
                .paymentType(payment.getPaymentType().name())
                .farmerId(payment.getFarmer() != null ? payment.getFarmer().getId() : null)
                .farmerName(payment.getFarmer() != null ? payment.getFarmer().getName() : null)
                .farmerCode(payment.getFarmer() != null ? payment.getFarmer().getFarmerId() : null)
                .buyerId(payment.getBuyer() != null ? payment.getBuyer().getId() : null)
                .buyerName(payment.getBuyer() != null ? payment.getBuyer().getName() : null)
                .buyerCode(payment.getBuyer() != null ? payment.getBuyer().getBuyerId() : null)
                .saleId(payment.getSale() != null ? payment.getSale().getId() : null)
                .saleInvoiceNumber(payment.getSale() != null ? payment.getSale().getInvoiceNumber() : null)
                .amount(payment.getAmount())
                .paymentMethod(payment.getPaymentMethod().name())
                .paymentDate(payment.getPaymentDate())
                .referenceNumber(payment.getReferenceNumber())
                .notes(payment.getNotes())
                .status(payment.getStatus().name())
                .createdAt(payment.getCreatedAt())
                .build();
    }
}
