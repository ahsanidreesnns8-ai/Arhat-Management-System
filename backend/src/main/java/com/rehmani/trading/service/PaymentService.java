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
    private final DheriRepository dheriRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public List<PaymentResponse> getAll() {
        return paymentRepository.findAllWithDetails()
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

    public List<PaymentResponse> getByDheri(Long dheriId) {
        return paymentRepository.findByDheriIdOrderByPaymentDateDescCreatedAtDesc(dheriId)
                .stream().map(this::toResponse).toList();
    }

    public List<PaymentResponse> getByDate(LocalDate date) {
        return paymentRepository.findByDateWithDetails(date)
                .stream().map(this::toResponse).toList();
    }

    public List<PaymentResponse> getByDheriAndDate(Long dheriId, LocalDate date) {
        return paymentRepository.findByDheriIdAndPaymentDateOrderByCreatedAtDesc(dheriId, date)
                .stream().map(this::toResponse).toList();
    }

    public PaymentResponse getById(Long id) {
        Payment payment = paymentRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Payment not found"));
        return toResponse(payment);
    }

    @Transactional
    public PaymentResponse record(PaymentRequest request) {
        PaymentType paymentType = parsePaymentType(request.getPaymentType());
        BigDecimal amount = request.getAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Payment amount must be greater than zero");
        }

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
            BigDecimal outstanding = farmer.getOutstandingBalance() != null
                    ? farmer.getOutstandingBalance() : BigDecimal.ZERO;
            if (amount.compareTo(outstanding) > 0) {
                throw new RuntimeException("Amount exceeds farmer outstanding balance of PKR " + outstanding);
            }
            payment.setFarmer(farmer);
            farmer.setOutstandingBalance(outstanding.subtract(amount));
            farmerRepository.save(farmer);
            if (request.getDheriId() != null) {
                Dheri dheri = dheriRepository.findByIdAndDeletedFalse(request.getDheriId())
                        .orElseThrow(() -> new RuntimeException("Dheri not found"));
                payment.setDheri(dheri);
            }
        } else {
            if (request.getBuyerId() == null) {
                throw new RuntimeException("Buyer ID is required for buyer payments");
            }
            Buyer buyer = buyerRepository.findByIdAndDeletedFalse(request.getBuyerId())
                    .orElseThrow(() -> new RuntimeException("Buyer not found"));
            BigDecimal outstanding = buyer.getOutstandingBalance() != null
                    ? buyer.getOutstandingBalance() : BigDecimal.ZERO;
            if (amount.compareTo(outstanding) > 0) {
                throw new RuntimeException("Amount exceeds buyer outstanding balance of PKR " + outstanding);
            }
            payment.setBuyer(buyer);
            buyer.setOutstandingBalance(outstanding.subtract(amount));
            buyerRepository.save(buyer);

            if (request.getSaleId() != null) {
                Sale sale = saleRepository.findByIdAndDeletedFalse(request.getSaleId())
                        .orElseThrow(() -> new RuntimeException("Sale not found"));
                BigDecimal saleTotal = sale.getTotalAmount() != null ? sale.getTotalAmount() : BigDecimal.ZERO;
                BigDecimal salePaid = sale.getPaidAmount() != null ? sale.getPaidAmount() : BigDecimal.ZERO;
                BigDecimal remaining = saleTotal.subtract(salePaid);
                if (amount.compareTo(remaining) > 0) {
                    throw new RuntimeException("Amount exceeds sale remaining balance of PKR " + remaining);
                }
                BigDecimal newPaidAmount = salePaid.add(amount);
                sale.setPaidAmount(newPaidAmount);
                sale.setPaymentStatus(determinePaymentStatus(saleTotal, newPaidAmount));
                saleRepository.save(sale);
                payment.setSale(sale);
            }
            if (request.getDheriId() != null) {
                Dheri dheri = dheriRepository.findByIdAndDeletedFalse(request.getDheriId())
                        .orElseThrow(() -> new RuntimeException("Dheri not found"));
                payment.setDheri(dheri);
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

    /**
     * Update an existing payment and re-settle farmer payable / buyer receivable accordingly.
     * Reverses the old amount on outstanding (and sale paidAmount), then applies the new amount.
     */
    @Transactional
    public PaymentResponse update(Long id, PaymentRequest request) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Payment not found"));

        BigDecimal newAmount = request.getAmount();
        if (newAmount == null || newAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Payment amount must be greater than zero");
        }

        String oldSnapshot = payment.getAmount().toPlainString();
        reverseEffects(payment);

        if (payment.getPaymentType() == PaymentType.FARMER) {
            Farmer farmer = payment.getFarmer();
            if (farmer == null) {
                throw new RuntimeException("Farmer not linked to this payment");
            }
            farmer = farmerRepository.findByIdAndDeletedFalse(farmer.getId())
                    .orElseThrow(() -> new RuntimeException("Farmer not found"));
            BigDecimal outstanding = safe(farmer.getOutstandingBalance());
            if (newAmount.compareTo(outstanding) > 0) {
                throw new RuntimeException("Amount exceeds farmer remaining to pay of PKR " + outstanding
                        + " (includes this payment after reverse)");
            }
            farmer.setOutstandingBalance(outstanding.subtract(newAmount));
            farmerRepository.save(farmer);
            payment.setFarmer(farmer);

            if (request.getDheriId() != null) {
                Dheri dheri = dheriRepository.findByIdAndDeletedFalse(request.getDheriId())
                        .orElseThrow(() -> new RuntimeException("Dheri not found"));
                payment.setDheri(dheri);
            }
        } else {
            Buyer buyer = payment.getBuyer();
            if (buyer == null) {
                throw new RuntimeException("Buyer not linked to this payment");
            }
            buyer = buyerRepository.findByIdAndDeletedFalse(buyer.getId())
                    .orElseThrow(() -> new RuntimeException("Buyer not found"));
            BigDecimal outstanding = safe(buyer.getOutstandingBalance());
            if (newAmount.compareTo(outstanding) > 0) {
                throw new RuntimeException("Amount exceeds buyer remaining receivable of PKR " + outstanding
                        + " (includes this payment after reverse)");
            }
            buyer.setOutstandingBalance(outstanding.subtract(newAmount));
            buyerRepository.save(buyer);
            payment.setBuyer(buyer);

            // Clear previous sale link (already reversed in reverseEffects)
            payment.setSale(null);
            Long saleId = request.getSaleId();
            if (saleId != null) {
                Sale sale = saleRepository.findByIdAndDeletedFalse(saleId)
                        .orElseThrow(() -> new RuntimeException("Sale not found"));
                BigDecimal remaining = sale.getTotalAmount().subtract(safe(sale.getPaidAmount()));
                if (newAmount.compareTo(remaining) > 0) {
                    throw new RuntimeException("Amount exceeds sale remaining balance of PKR " + remaining);
                }
                BigDecimal newPaidAmount = safe(sale.getPaidAmount()).add(newAmount);
                sale.setPaidAmount(newPaidAmount);
                sale.setPaymentStatus(determinePaymentStatus(sale.getTotalAmount(), newPaidAmount));
                saleRepository.save(sale);
                payment.setSale(sale);
            }
            if (request.getDheriId() != null) {
                Dheri dheri = dheriRepository.findByIdAndDeletedFalse(request.getDheriId())
                        .orElseThrow(() -> new RuntimeException("Dheri not found"));
                payment.setDheri(dheri);
            }
        }

        payment.setAmount(newAmount);
        payment.setPaymentMethod(parsePaymentMethod(request.getPaymentMethod()));
        if (request.getPaymentDate() != null) {
            payment.setPaymentDate(request.getPaymentDate());
        }
        if (request.getReferenceNumber() != null) {
            payment.setReferenceNumber(request.getReferenceNumber());
        }
        if (request.getNotes() != null) {
            payment.setNotes(request.getNotes());
        }

        Payment saved = paymentRepository.save(payment);
        auditService.log(
                resolveCurrentUser() != null ? resolveCurrentUser().getId() : null,
                "UPDATE",
                "Payment",
                saved.getId(),
                oldSnapshot,
                saved.getAmount().toPlainString()
        );
        return toResponse(saved);
    }

    /** Delete a payment and restore farmer payable / buyer receivable. */
    @Transactional
    public void delete(Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Payment not found"));
        String oldSnapshot = payment.getAmount().toPlainString();
        reverseEffects(payment);
        paymentRepository.delete(payment);
        auditService.log(
                resolveCurrentUser() != null ? resolveCurrentUser().getId() : null,
                "DELETE",
                "Payment",
                id,
                oldSnapshot,
                null
        );
    }

    /** Undo balance impact of a payment (outstanding + optional sale paidAmount). */
    private void reverseEffects(Payment payment) {
        BigDecimal amount = safe(payment.getAmount());
        if (payment.getPaymentType() == PaymentType.FARMER && payment.getFarmer() != null) {
            Farmer farmer = farmerRepository.findByIdAndDeletedFalse(payment.getFarmer().getId())
                    .orElseThrow(() -> new RuntimeException("Farmer not found"));
            farmer.setOutstandingBalance(safe(farmer.getOutstandingBalance()).add(amount));
            farmerRepository.save(farmer);
            payment.setFarmer(farmer);
        } else if (payment.getPaymentType() == PaymentType.BUYER && payment.getBuyer() != null) {
            Buyer buyer = buyerRepository.findByIdAndDeletedFalse(payment.getBuyer().getId())
                    .orElseThrow(() -> new RuntimeException("Buyer not found"));
            buyer.setOutstandingBalance(safe(buyer.getOutstandingBalance()).add(amount));
            buyerRepository.save(buyer);
            payment.setBuyer(buyer);

            if (payment.getSale() != null) {
                Sale sale = saleRepository.findByIdAndDeletedFalse(payment.getSale().getId()).orElse(null);
                if (sale != null) {
                    BigDecimal newPaid = safe(sale.getPaidAmount()).subtract(amount);
                    if (newPaid.compareTo(BigDecimal.ZERO) < 0) {
                        newPaid = BigDecimal.ZERO;
                    }
                    sale.setPaidAmount(newPaid);
                    sale.setPaymentStatus(determinePaymentStatus(sale.getTotalAmount(), newPaid));
                    saleRepository.save(sale);
                }
            }
        }
    }

    private BigDecimal safe(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
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
                .dheriId(payment.getDheri() != null ? payment.getDheri().getId() : null)
                .dheriCode(payment.getDheri() != null ? payment.getDheri().getDheriId() : null)
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
