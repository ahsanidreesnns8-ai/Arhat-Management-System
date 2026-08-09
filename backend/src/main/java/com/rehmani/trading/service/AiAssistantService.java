package com.rehmani.trading.service;

import com.rehmani.trading.dto.AiChatMessage;
import com.rehmani.trading.dto.AiChatRequest;
import com.rehmani.trading.dto.AiChatResponse;
import com.rehmani.trading.entity.Buyer;
import com.rehmani.trading.entity.Farmer;
import com.rehmani.trading.entity.QueueStatus;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAssistantService {

    private static final Pattern GREETING = Pattern.compile(
            "^(hi+|hello|hey|salam|assalam|assalamualaikum|aoa|good\\s*(morning|afternoon|evening)|سلام|ہائے|ہیلو)[!?.\\s]*$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final String[] BUSINESS_KEYWORDS = {
            "stock", "inventory", "queue", "farmer", "buyer", "dheri", "outstanding",
            "balance", "sales", "revenue", "commission", "truck", "invoice",
            "اسٹاک", "قطار", "کسان", "خریدار", "ڈھیری", "بقایا", "فروخت", "آمدنی"
    };

    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final StockRepository stockRepository;
    private final DheriRepository dheriRepository;
    private final SaleRepository saleRepository;
    private final QueueEntryRepository queueEntryRepository;
    private final BusinessSettingsRepository settingsRepository;
    private final GeneralWorldAiService generalWorldAiService;

    public AiChatResponse chat(AiChatRequest request) {
        try {
            String raw = request != null && request.getMessage() != null
                    ? request.getMessage().trim()
                    : "";
            String language = request != null && request.getLanguage() != null
                    ? request.getLanguage()
                    : "en";
            boolean urdu = "ur".equalsIgnoreCase(language);
            List<AiChatMessage> history = request != null ? request.getHistory() : null;

            if (raw.isEmpty()) {
                return reply(urdu
                        ? "براہ کرم کوئی سوال لکھیں — کاروبار یا دنیا کے کسی بھی موضوع پر۔"
                        : "Please type a question — about your business or any topic in the world.",
                        "system");
            }

            String message = raw.toLowerCase(Locale.ROOT);

            if (GREETING.matcher(raw).matches() || GREETING.matcher(message).matches()) {
                return reply(urdu
                        ? "السلام علیکم! میں Rhmani اسسٹنٹ ہوں۔ آپ کاروباری ڈیٹا (اسٹاک، فروخت، قطار) یا دنیا کے کسی بھی سوال کے بارے میں پوچھ سکتے ہیں۔"
                        : "Hello! I'm the Rhmani assistant. Ask about business data (stock, sales, queue) or any general world question — science, history, geography, definitions, math, and more.",
                        "system");
            }

            if (containsAny(message, "help", "what can you", "options", "commands", "مدد", "کیا کر سکتے")) {
                return reply(urdu
                        ? "میں مدد کر سکتا ہوں:\n• کاروبار: اسٹاک، قطار، کسان/خریدار، بقایا، آج کی فروخت، کمپنی معلومات\n• عام علم: تاریخ، سائنس، جغرافیہ، تعریفیں، دارالحکومت، موسم، حساب\n• گفتگو کے لیے Gemini API کلید سیٹ کریں تاکہ ہر موضوع پر مکمل جواب ملے"
                        : "I can help with:\n• Business: stock, queue, farmers/buyers, balances, today's sales, company info\n• World knowledge: history, science, geography, definitions, capitals, weather, math\n• For full conversational AI on any topic, set GEMINI_API_KEY in the backend",
                        "system");
            }

            // Prefer live ERP answers when the question is clearly about business data
            Optional<AiChatResponse> business = tryBusinessAnswer(message, raw, urdu);
            if (business.isPresent()) {
                return business.get();
            }

            if (containsAny(message, "thank", "شکریہ", "thanks")) {
                return reply(urdu
                        ? "خوشی ہوئی! جب چاہیں پوچھیں۔"
                        : "You're welcome! Ask anytime — business or general questions.",
                        "system");
            }

            // General world / open questions
            Optional<String> world = generalWorldAiService.answer(raw, language, history);
            if (world.isPresent()) {
                String source = world.get().contains("wikipedia.org") ? "wikipedia"
                        : world.get().contains("GEMINI_API_KEY") ? "knowledge"
                        : "world_ai";
                return reply(world.get(), source);
            }

            return reply(urdu
                    ? "معذرت، اس وقت جواب نہیں دے سکا۔ دوبارہ کوشش کریں۔"
                    : "Sorry — I couldn't answer that right now. Please try again.",
                    "system");
        } catch (Exception ex) {
            log.error("AI chat failed", ex);
            return reply(
                    "I hit a temporary issue. Please try again — business data or any world question.",
                    "system");
        }
    }

    private Optional<AiChatResponse> tryBusinessAnswer(String message, String raw, boolean urdu) {
        boolean businessLike = containsAny(message, BUSINESS_KEYWORDS)
                || containsAny(raw.toLowerCase(Locale.ROOT), BUSINESS_KEYWORDS)
                || containsAny(message, "company", "rehmani", "rhmani", "رحمانی");
        if (!businessLike) {
            return Optional.empty();
        }

        try {
            if (containsAny(message, "stock", "inventory", "اسٹاک")) {
                BigDecimal total = stockRepository.getTotalStockQuantity();
                if (total == null) total = BigDecimal.ZERO;
                return Optional.of(reply(urdu
                        ? "موجودہ کل کاروباری اسٹاک: " + total + " یونٹس (تمام مصنوعات)۔"
                        : "Current total business stock is " + total + " units across all products.",
                        "stock"));
            }

            if (containsAny(message, "queue", "قطار")) {
                int pending = queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.PENDING).size();
                int active = queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.ACTIVE).size();
                return Optional.of(reply(urdu
                        ? "قطار کی صورتحال — زیر التواء: " + pending + "، فعال: " + active + "۔"
                        : "Queue status — Pending: " + pending + ", Active: " + active + ".",
                        "queue_entries"));
            }

            if (containsAny(message, "farmer", "کسان")) {
                long count = farmerRepository.countByDeletedFalse();
                return Optional.of(reply(urdu
                        ? "سسٹم میں فعال کسان: " + count + "۔"
                        : "You have " + count + " active farmers registered in the system.",
                        "farmers"));
            }

            if (containsAny(message, "buyer", "خریدار")) {
                long count = buyerRepository.countByDeletedFalse();
                return Optional.of(reply(urdu
                        ? "سسٹم میں فعال خریدار: " + count + "۔"
                        : "You have " + count + " active buyers registered in the system.",
                        "buyers"));
            }

            if (containsAny(message, "dheri", "ڈھیری")) {
                int count = dheriRepository.findByDeletedFalseOrderByCreatedAtDesc().size();
                return Optional.of(reply(urdu
                        ? "ڈھیری ریکارڈز: " + count + "۔"
                        : "There are " + count + " dheri records in the system.",
                        "dheris"));
            }

            if (containsAny(message, "outstanding", "balance", "باقی", "بقایا")) {
                BigDecimal farmerTotal = farmerRepository.findByDeletedFalseOrderByCreatedAtDesc().stream()
                        .map(Farmer::getOutstandingBalance)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal buyerTotal = buyerRepository.findByDeletedFalseOrderByCreatedAtDesc().stream()
                        .map(Buyer::getOutstandingBalance)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                return Optional.of(reply(urdu
                        ? "کسانوں کا کل بقایا: PKR " + farmerTotal + "۔ خریداروں کا کل بقایا: PKR " + buyerTotal + "۔"
                        : "Total outstanding farmer balance: PKR " + farmerTotal
                                + ". Total outstanding buyer balance: PKR " + buyerTotal + ".",
                        "farmers & buyers"));
            }

            if (containsAny(message, "company", "rehmani", "rhmani", "رحمانی")) {
                var settings = settingsRepository.findAll().stream().findFirst().orElse(null);
                if (settings != null) {
                    return Optional.of(reply(
                            settings.getCompanyName() + " — " + nullSafe(settings.getAddress())
                                    + ". Contact: " + nullSafe(settings.getPhone()) + ", " + nullSafe(settings.getEmail()),
                            "business_settings"));
                }
            }

            if (containsAny(message, "sales", "revenue", "فروخت", "آمدنی")) {
                BigDecimal todaySales = saleRepository.getTotalSalesByDate(LocalDate.now());
                if (todaySales == null) todaySales = BigDecimal.ZERO;
                return Optional.of(reply(urdu
                        ? "آج کی کل فروخت: PKR " + todaySales + "۔"
                        : "Today's total sales revenue is PKR " + todaySales + ".",
                        "sales"));
            }
        } catch (Exception ex) {
            log.warn("Business AI lookup failed, falling back to world AI: {}", ex.getMessage());
            return Optional.empty();
        }

        return Optional.empty();
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
