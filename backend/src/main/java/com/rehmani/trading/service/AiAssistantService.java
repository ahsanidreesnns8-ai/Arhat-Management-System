package com.rehmani.trading.service;

import com.rehmani.trading.dto.AiChatRequest;
import com.rehmani.trading.dto.AiChatResponse;
import com.rehmani.trading.entity.Buyer;
import com.rehmani.trading.entity.Farmer;
import com.rehmani.trading.entity.QueueStatus;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AiAssistantService {

    private static final Pattern GREETING = Pattern.compile(
            "^(hi+|hello|hey|salam|assalam|assalamualaikum|aoa|good\\s*(morning|afternoon|evening)|سلام|ہائے|ہیلو)[!?.\\s]*$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final StockRepository stockRepository;
    private final DheriRepository dheriRepository;
    private final SaleRepository saleRepository;
    private final QueueEntryRepository queueEntryRepository;
    private final BusinessSettingsRepository settingsRepository;

    public AiChatResponse chat(AiChatRequest request) {
        try {
            String raw = request != null && request.getMessage() != null
                    ? request.getMessage().trim()
                    : "";
            if (raw.isEmpty()) {
                return reply("Please type a question — for example: \"How much stock is left?\" or \"Today's sales\".",
                        "system");
            }

            String message = raw.toLowerCase(Locale.ROOT);

            if (GREETING.matcher(raw).matches() || GREETING.matcher(message).matches()) {
                return reply(
                        "Hello! I'm the Rhmani Trading assistant. I can answer questions about stock, queue, farmers, buyers, sales, and outstanding balances.",
                        "system");
            }

            if (containsAny(message, "help", "what can you", "options", "commands")) {
                return reply(
                        "You can ask me about:\n• Current stock / inventory\n• Queue status\n• Farmer or buyer counts\n• Outstanding balances\n• Today's sales / revenue\n• Company information\n\nTry: \"How much stock is left?\" or \"What's today's sales?\"",
                        "system");
            }

            if (containsAny(message, "stock", "inventory", "انڈے", "اسٹاک")) {
                BigDecimal total = stockRepository.getTotalStockQuantity();
                if (total == null) total = BigDecimal.ZERO;
                return reply("Current total business stock is " + total + " units across all products.", "stock");
            }

            if (containsAny(message, "queue", "قطار")) {
                int pending = queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.PENDING).size();
                int active = queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.ACTIVE).size();
                return reply("Queue status — Pending: " + pending + ", Active: " + active + ".", "queue_entries");
            }

            if (containsAny(message, "farmer", "کسان")) {
                long count = farmerRepository.countByDeletedFalse();
                return reply("You have " + count + " active farmers registered in the system.", "farmers");
            }

            if (containsAny(message, "buyer", "خریدار")) {
                long count = buyerRepository.countByDeletedFalse();
                return reply("You have " + count + " active buyers registered in the system.", "buyers");
            }

            if (containsAny(message, "dheri", "ڈھیری")) {
                int count = dheriRepository.findByDeletedFalseOrderByCreatedAtDesc().size();
                return reply("There are " + count + " dheri records in the system.", "dheris");
            }

            if (containsAny(message, "outstanding", "balance", "باقی", "بقایا")) {
                BigDecimal farmerTotal = farmerRepository.findByDeletedFalseOrderByCreatedAtDesc().stream()
                        .map(Farmer::getOutstandingBalance)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal buyerTotal = buyerRepository.findByDeletedFalseOrderByCreatedAtDesc().stream()
                        .map(Buyer::getOutstandingBalance)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                return reply(
                        "Total outstanding farmer balance: PKR " + farmerTotal
                                + ". Total outstanding buyer balance: PKR " + buyerTotal + ".",
                        "farmers & buyers");
            }

            if (containsAny(message, "company", "rehmani", "rhmani", "رحمانی")) {
                var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
                if (settings != null) {
                    return reply(
                            settings.getCompanyName() + " — " + nullSafe(settings.getAddress())
                                    + ". Contact: " + nullSafe(settings.getPhone()) + ", " + nullSafe(settings.getEmail()),
                            "business_settings");
                }
            }

            if (containsAny(message, "sales", "revenue", "فروخت", "آمدنی")) {
                BigDecimal todaySales = saleRepository.getTotalSalesByDate(LocalDate.now());
                if (todaySales == null) todaySales = BigDecimal.ZERO;
                return reply("Today's total sales revenue is PKR " + todaySales + ".", "sales");
            }

            if (containsAny(message, "thank", "شکریہ")) {
                return reply("You're welcome! Ask anytime if you need business figures.", "system");
            }

            return reply(
                    "I can help with stock levels, queue status, farmer/buyer counts, outstanding balances, today's sales, and company info. Try asking: \"How much stock is left?\" or \"What's today's sales?\"",
                    "system");
        } catch (Exception ex) {
            return reply(
                    "I hit a temporary issue reading business data, but I'm still here. Try asking about stock, queue, farmers, buyers, or today's sales.",
                    "system");
        }
    }

    private AiChatResponse reply(String text, String source) {
        return AiChatResponse.builder().reply(text).source(source).build();
    }

    private boolean containsAny(String message, String... keywords) {
        for (String k : keywords) {
            if (message.contains(k.toLowerCase(Locale.ROOT))) return true;
        }
        return false;
    }

    private String nullSafe(String value) {
        return value != null && !value.isBlank() ? value : "N/A";
    }
}
