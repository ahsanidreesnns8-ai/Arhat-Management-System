package com.rehmani.trading.service;

import com.rehmani.trading.dto.AiChatRequest;
import com.rehmani.trading.dto.AiChatResponse;
import com.rehmani.trading.entity.Buyer;
import com.rehmani.trading.entity.Farmer;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AiAssistantService {

    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final StockRepository stockRepository;
    private final DheriRepository dheriRepository;
    private final SaleRepository saleRepository;
    private final QueueEntryRepository queueEntryRepository;
    private final BusinessSettingsRepository settingsRepository;

    public AiChatResponse chat(AiChatRequest request) {
        String message = request.getMessage().toLowerCase(Locale.ROOT).trim();

        if (message.contains("stock") || message.contains("inventory")) {
            BigDecimal total = stockRepository.getTotalStockQuantity();
            return AiChatResponse.builder()
                    .reply("Current total business stock is " + total + " units across all products.")
                    .source("stock table")
                    .build();
        }

        if (message.contains("queue")) {
            int pending = queueEntryRepository.findByStatusOrderByPositionAsc(
                    com.rehmani.trading.entity.QueueStatus.PENDING).size();
            return AiChatResponse.builder()
                    .reply("There are currently " + pending + " dheris pending in the queue.")
                    .source("queue_entries table")
                    .build();
        }

        if (message.contains("farmer")) {
            long count = farmerRepository.countByDeletedFalse();
            return AiChatResponse.builder()
                    .reply("You have " + count + " active farmers registered in the system.")
                    .source("farmers table")
                    .build();
        }

        if (message.contains("buyer")) {
            long count = buyerRepository.countByDeletedFalse();
            return AiChatResponse.builder()
                    .reply("You have " + count + " active buyers registered in the system.")
                    .source("buyers table")
                    .build();
        }

        if (message.contains("dheri")) {
            int count = dheriRepository.findByDeletedFalseOrderByCreatedAtDesc().size();
            return AiChatResponse.builder()
                    .reply("There are " + count + " dheri records in the system.")
                    .source("dheris table")
                    .build();
        }

        if (message.contains("outstanding") || message.contains("balance")) {
            var farmers = farmerRepository.findByDeletedFalseOrderByCreatedAtDesc();
            BigDecimal farmerTotal = farmers.stream()
                    .map(Farmer::getOutstandingBalance)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            var buyers = buyerRepository.findByDeletedFalseOrderByCreatedAtDesc();
            BigDecimal buyerTotal = buyers.stream()
                    .map(Buyer::getOutstandingBalance)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            return AiChatResponse.builder()
                    .reply("Total outstanding farmer balance: PKR " + farmerTotal +
                            ". Total outstanding buyer balance: PKR " + buyerTotal + ".")
                    .source("farmers & buyers tables")
                    .build();
        }

        if (message.contains("company") || message.contains("rehmani")) {
            var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
            if (settings != null) {
                return AiChatResponse.builder()
                        .reply(settings.getCompanyName() + " — " + settings.getAddress() +
                                ". Contact: " + settings.getPhone() + ", " + settings.getEmail())
                        .source("business_settings table")
                        .build();
            }
        }

        if (message.contains("sales") || message.contains("revenue")) {
            var today = java.time.LocalDate.now();
            BigDecimal todaySales = saleRepository.getTotalSalesByDate(today);
            return AiChatResponse.builder()
                    .reply("Today's total sales revenue is PKR " + (todaySales != null ? todaySales : BigDecimal.ZERO) + ".")
                    .source("sales table")
                    .build();
        }

        return AiChatResponse.builder()
                .reply("I can help with stock levels, queue status, farmer/buyer counts, outstanding balances, " +
                        "today's sales, and company info. Try asking: \"How much stock is left?\" or " +
                        "\"What's the queue status?\"")
                .source("system")
                .build();
    }
}
