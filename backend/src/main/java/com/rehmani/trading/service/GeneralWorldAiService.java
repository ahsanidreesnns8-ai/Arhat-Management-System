package com.rehmani.trading.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rehmani.trading.dto.AiChatMessage;
import com.rehmani.trading.entity.BusinessSettings;
import com.rehmani.trading.repository.BusinessSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pro-level world AI: Gemini/OpenAI/Groq when configured, otherwise a multi-source
 * research engine (Wikipedia, dictionary, capitals, weather, math) with junk filtering.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GeneralWorldAiService {

    private static final Pattern MATH_EXPR = Pattern.compile("^[\\d\\s.+\\-*/()%^]+$");
    private static final Pattern DEFINE = Pattern.compile(
            "^(?:what\\s+is\\s+(?:the\\s+)?(?:meaning\\s+of\\s+)?|define\\s+|meaning\\s+of\\s+)(.+?)\\??$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CAPITAL = Pattern.compile(
            "^(?:what\\s+is\\s+)?(?:the\\s+)?capital\\s+(?:city\\s+)?(?:of\\s+)(.+?)\\??$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern WEATHER_Q = Pattern.compile(
            "weather|temperature|forecast|موسم",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern MARKET_Q = Pattern.compile(
            "\\b(rate|price|mandi|bazaar|market|per\\s*40|40\\s*kg|mann|من|ریٹ|قیمت|منڈی)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern JUNK_ANSWER = Pattern.compile(
            "(?i)(url\\s*decoded|decoded\\s*:|javascript:|undefined|null\\b|^https?://|^www\\.)");

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;
    private final BusinessSettingsRepository settingsRepository;

    @Value("${app.ai.gemini-api-key:}")
    private String geminiApiKeyEnv;

    @Value("${app.ai.openai-api-key:}")
    private String openaiApiKey;

    @Value("${app.ai.groq-api-key:}")
    private String groqApiKey;

    @Value("${app.ai.openai-base-url:https://api.openai.com/v1}")
    private String openaiBaseUrl;

    @Value("${app.ai.openai-model:gpt-4o-mini}")
    private String openaiModel;

    @Value("${app.ai.gemini-model:gemini-2.0-flash}")
    private String geminiModel;

    @Value("${app.ai.groq-model:llama-3.3-70b-versatile}")
    private String groqModel;

    public Optional<String> answer(String question, String language, List<AiChatMessage> history) {
        String q = question == null ? "" : question.trim();
        if (q.isBlank()) return Optional.empty();
        boolean urdu = "ur".equalsIgnoreCase(language);

        Optional<String> math = tryMath(q, urdu);
        if (math.isPresent()) return math;

        // Prefer real LLMs first for open-world quality
        Optional<String> llm = tryLlm(q, language, history);
        if (llm.isPresent()) return llm;

        Optional<String> capital = tryCapital(q, urdu);
        if (capital.isPresent()) return capital;

        Optional<String> definition = tryDefinition(q, urdu);
        if (definition.isPresent()) return definition;

        Optional<String> weather = tryWeatherQuestion(q, urdu);
        if (weather.isPresent()) return weather;

        if (MARKET_Q.matcher(q).find()) {
            Optional<String> market = tryMarketAnswer(q, urdu);
            if (market.isPresent()) return market;
        }

        Optional<String> wiki = tryWikipedia(q, urdu);
        if (wiki.isPresent()) return wiki;

        Optional<String> ddg = tryDuckDuckGo(q, urdu);
        if (ddg.isPresent()) return ddg;

        // Last attempt: Wikipedia on extracted keywords
        Optional<String> wikiLoose = tryWikipedia(extractTopic(q), urdu);
        if (wikiLoose.isPresent()) return wikiLoose;

        return Optional.of(fallbackMessage(q, urdu));
    }

    private String resolveGeminiKey() {
        // Prefer server env; fall back to DB only if previously seeded by ops (not via Settings UI)
        if (hasText(geminiApiKeyEnv)) return geminiApiKeyEnv.trim();
        try {
            return settingsRepository.findAll().stream()
                    .findFirst()
                    .map(BusinessSettings::getGeminiApiKey)
                    .filter(this::hasText)
                    .map(String::trim)
                    .orElse("");
        } catch (Exception ex) {
            return "";
        }
    }

    private Optional<String> tryLlm(String question, String language, List<AiChatMessage> history) {
        // Prefer Gemini, then Groq (fast free-tier), then OpenAI-compatible
        String geminiKey = resolveGeminiKey();
        if (hasText(geminiKey)) {
            try {
                return Optional.of(callGemini(geminiKey, question, language, history));
            } catch (Exception ex) {
                log.warn("Gemini AI failed: {}", ex.getMessage());
            }
        }
        if (hasText(groqApiKey)) {
            try {
                return Optional.of(callOpenAiCompatible(
                        "https://api.groq.com/openai/v1",
                        groqApiKey.trim(),
                        groqModel,
                        question,
                        language,
                        history));
            } catch (Exception ex) {
                log.warn("Groq AI failed: {}", ex.getMessage());
            }
        }
        if (hasText(openaiApiKey)) {
            try {
                return Optional.of(callOpenAiCompatible(
                        openaiBaseUrl,
                        openaiApiKey.trim(),
                        openaiModel,
                        question,
                        language,
                        history));
            } catch (Exception ex) {
                log.warn("OpenAI failed: {}", ex.getMessage());
            }
        }
        return Optional.empty();
    }

    private String systemPrompt(String language) {
        boolean urdu = "ur".equalsIgnoreCase(language);
        if (urdu) {
            return """
                    آپ Rehmani Trading Company (آرھٹ) کے پیشہ ور AI اسسٹنٹ ہیں۔
                    جواب ہمیشہ درست، واضح اور فوری طور پر مفید ہو۔ پہلے مختصر جواب، پھر ضروری تفصیل۔
                    کاروبار: کسان قابل ادائیگی، خریدار قابل وصول، ڈھیری، فروخت، کمیشن 4% (آرھٹ 3% + منشی 0.70% + ورکرز 0.30%)، Price Calculator۔
                    منڈی ریٹ: لائیو ریٹ بدلتے رہتے ہیں — عملی رہنمائی دیں اور مقامی منڈی سے تصدیق کی تلقین کریں۔
                    مقام: گالا منڈی ننکانہ صاحب۔
                    صارف کی زبان میں جواب دیں۔ نقص کی مشورہ نہ دیں۔
                    """;
        }
        return """
                You are the professional AI assistant for Rehmani Trading Company (arhat / commission agency ERP).
                Always answer clearly and usefully: lead with the direct answer, then short supporting detail.
                Business domain: farmer payables, buyer receivables, dheris, sales, payments, and commission of total amount
                (Arhat 3% + Munshi 0.70% + Workers 0.30% = 4%). Guide users to Price Calculator / Farmer Product / Arhat Sale when relevant.
                For mandi/market rates: rates change daily — give practical guidance and advise confirming with the local mandi.
                Location context: Gala Mandi Nankana Sahib.
                Match the user's language (English or Urdu). Be professional. Refuse harmful/illegal advice.
                """;
    }

    private String callGemini(String apiKey, String question, String language, List<AiChatMessage> history) throws Exception {
        List<Map<String, Object>> contents = new ArrayList<>();
        if (history != null) {
            for (AiChatMessage msg : history) {
                if (msg == null || !hasText(msg.getContent())) continue;
                String role = "assistant".equalsIgnoreCase(msg.getRole()) ? "model" : "user";
                contents.add(Map.of("role", role, "parts", List.of(Map.of("text", msg.getContent()))));
            }
        }
        contents.add(Map.of("role", "user", "parts", List.of(Map.of("text", question))));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt(language)))));
        body.put("contents", contents);
        body.put("generationConfig", Map.of("temperature", 0.65, "maxOutputTokens", 2500));

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + apiKey;

        String raw = restClientBuilder.build()
                .post().uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        JsonNode text = objectMapper.readTree(raw)
                .path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (!text.isTextual() || text.asText().isBlank()) {
            throw new IllegalStateException("Empty Gemini response");
        }
        return cleanAnswer(text.asText().trim());
    }

    private String callOpenAiCompatible(
            String baseUrl, String apiKey, String model,
            String question, String language, List<AiChatMessage> history) throws Exception {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt(language)));
        if (history != null) {
            for (AiChatMessage msg : history) {
                if (msg == null || !hasText(msg.getContent())) continue;
                String role = "assistant".equalsIgnoreCase(msg.getRole()) ? "assistant" : "user";
                messages.add(Map.of("role", role, "content", msg.getContent()));
            }
        }
        messages.add(Map.of("role", "user", "content", question));

        Map<String, Object> body = Map.of("model", model, "messages", messages, "temperature", 0.65);

        String raw = restClientBuilder.build()
                .post()
                .uri(baseUrl.replaceAll("/$", "") + "/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(body)
                .retrieve()
                .body(String.class);

        JsonNode text = objectMapper.readTree(raw).path("choices").path(0).path("message").path("content");
        if (!text.isTextual() || text.asText().isBlank()) {
            throw new IllegalStateException("Empty LLM response");
        }
        return cleanAnswer(text.asText().trim());
    }

    private Optional<String> tryMarketAnswer(String q, boolean urdu) {
        String commodity = "grain";
        String ql = q.toLowerCase(Locale.ROOT);
        if (ql.contains("rice") || ql.contains("چاول")) commodity = "rice";
        else if (ql.contains("wheat") || ql.contains("گندم")) commodity = "wheat";
        else if (ql.contains("corn") || ql.contains("makai") || ql.contains("مکئی")) commodity = "corn";
        else if (ql.contains("cotton") || ql.contains("کپاس")) commodity = "cotton";

        String location = "Punjab, Pakistan";
        Matcher loc = Pattern.compile(
                "(?i)\\bin\\s+([A-Za-z\\u0600-\\u06FF ]{2,40})").matcher(q);
        if (loc.find()) location = loc.group(1).trim();

        String wikiTopic = commodity.equals("rice") ? "Rice production in Pakistan"
                : commodity.equals("wheat") ? "Wheat production in Pakistan"
                : commodity + " Pakistan";
        String context = tryWikipedia(wikiTopic, false).orElse("");
        if (context.length() > 500) context = context.substring(0, 500) + "...";

        if (urdu) {
            return Optional.of("""
                    **منڈی ریٹ رہنمائی — %s (%s)**

                    میں لائیو منڈی ریٹ کا براہِ راست فیڈ اس لمحے کنیکٹ نہیں کر سکا (ریٹ گھنٹے/دن کے ساتھ بدلتے رہتے ہیں)۔

                    عملی طریقہ:
                    1. %s منڈی / آڑھتی سے آج کا ریٹ فی 40 کلو / فی من تصدیق کریں
                    2. Rhmani ERP میں **Price Calculator** یا **Dheri** پر وہی ریٹ درج کریں
                    3. فروخت/کمیشن خود بخود درست حساب ہو جائے گا

                    نوٹ: پاکستان میں اناج عموماً **فی من (40 کلو)** یا **فی 40 کلو بورا** کے حساب سے ریٹ ہوتا ہے۔
                    کمیشن ماڈل: کل رقم کا **4%%** (آرھٹ 3%% + منشی 0.70%% + ورکرز 0.30%%)۔
                    %s
                    """.formatted(commodity, location, location,
                    hasText(context) ? "\nپس منظر:\n" + context.replaceAll("\\*\\*", "") : ""));
        }

        return Optional.of("""
                **Market rate guidance — %s in %s**

                Live mandi quotes move through the day, so confirm today's figure locally.

                Practical next steps:
                1. Confirm today's rate per **40 kg / per mann** from the %s mandi / arhati
                2. Enter that rate in **Price Calculator**, **Farmer Product**, or **Arhat Sale**
                3. Farmer payable uses **4%% commission** on total (Arhat 3%% + Munshi 0.70%% + Workers 0.30%%)

                %s
                """.formatted(commodity, location, location,
                hasText(context) ? "Background:\n" + context.replaceAll("\\*\\*", "") : ""));
    }

    private Optional<String> tryMath(String q, boolean urdu) {
        String expr = q.replaceAll("(?i)(what\\s+is|calculate|compute|solve|=|\\?)", "").trim();
        expr = expr.replace('×', '*').replace('÷', '/');
        if (expr.isBlank() || !MATH_EXPR.matcher(expr).matches() || !expr.matches(".*\\d.*")) {
            return Optional.empty();
        }
        try {
            BigDecimal result = new MathParser(expr.replaceAll("\\s+", "")).parse();
            String formatted = result.stripTrailingZeros().toPlainString();
            return Optional.of(urdu ? "حساب کا نتیجہ: " + formatted : "Result: " + formatted);
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private Optional<String> tryCapital(String q, boolean urdu) {
        Matcher m = CAPITAL.matcher(q.trim());
        if (!m.matches()) return Optional.empty();
        String country = m.group(1).trim();
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://restcountries.com/v3.1/name/" + encode(country))
                    .queryParam("fields", "name,capital,region,population")
                    .toUriString();
            String raw = restClientBuilder.build().get().uri(url).retrieve().body(String.class);
            JsonNode arr = objectMapper.readTree(raw);
            if (!arr.isArray() || arr.isEmpty()) return Optional.empty();
            JsonNode c = arr.get(0);
            String name = c.path("name").path("common").asText(country);
            String capital = c.path("capital").isArray() && !c.path("capital").isEmpty()
                    ? c.path("capital").get(0).asText() : "N/A";
            String region = c.path("region").asText("");
            long pop = c.path("population").asLong(0);
            if (urdu) {
                return Optional.of("**" + name + "** کا دارالحکومت **" + capital + "** ہے۔\nعلاقہ: "
                        + region + "\nآبادی: " + String.format(Locale.US, "%,d", pop));
            }
            return Optional.of("The capital of **" + name + "** is **" + capital + "**.\nRegion: "
                    + region + "\nPopulation: " + String.format(Locale.US, "%,d", pop));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private Optional<String> tryDefinition(String q, boolean urdu) {
        Matcher m = DEFINE.matcher(q.trim());
        String word = m.matches() ? m.group(1).trim() : null;
        if (word == null && q.split("\\s+").length <= 2 && q.matches("[A-Za-z\\-\\s]+\\??")) {
            word = q.replace("?", "").trim();
        }
        if (word == null || word.length() < 2 || word.split("\\s+").length > 3) return Optional.empty();
        // skip market-ish
        if (MARKET_Q.matcher(word).find()) return Optional.empty();
        try {
            String url = "https://api.dictionaryapi.dev/api/v2/entries/en/" + encode(word);
            String raw = restClientBuilder.build().get().uri(url).retrieve().body(String.class);
            JsonNode arr = objectMapper.readTree(raw);
            if (!arr.isArray() || arr.isEmpty()) return Optional.empty();
            JsonNode entry = arr.get(0);
            String term = entry.path("word").asText(word);
            StringBuilder sb = new StringBuilder();
            sb.append(urdu ? "**" + term + "** — تعریف:\n\n" : "**" + term + "** — definition:\n\n");
            int shown = 0;
            for (JsonNode meaning : entry.path("meanings")) {
                String part = meaning.path("partOfSpeech").asText("");
                for (JsonNode def : meaning.path("definitions")) {
                    sb.append("• (").append(part).append(") ").append(def.path("definition").asText()).append("\n");
                    if (++shown >= 4) break;
                }
                if (shown >= 4) break;
            }
            return Optional.of(sb.toString().trim());
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private Optional<String> tryWeatherQuestion(String q, boolean urdu) {
        if (!WEATHER_Q.matcher(q).find()) return Optional.empty();
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", 31.5204)
                    .queryParam("longitude", 74.3587)
                    .queryParam("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m")
                    .queryParam("timezone", "Asia/Karachi")
                    .toUriString();
            JsonNode cur = objectMapper.readTree(
                    restClientBuilder.build().get().uri(url).retrieve().body(String.class)).path("current");
            double temp = cur.path("temperature_2m").asDouble();
            int humidity = cur.path("relative_humidity_2m").asInt();
            double wind = cur.path("wind_speed_10m").asDouble();
            String condition = weatherLabel(cur.path("weather_code").asInt(), urdu);
            if (urdu) {
                return Optional.of("لاہور علاقے کا موجودہ موسم:\n• حالت: " + condition
                        + "\n• درجہ حرارت: " + Math.round(temp) + "°C\n• نمی: " + humidity
                        + "%\n• ہوا: " + Math.round(wind) + " km/h");
            }
            return Optional.of("Current weather (Lahore area):\n• Condition: " + condition
                    + "\n• Temperature: " + Math.round(temp) + "°C\n• Humidity: " + humidity
                    + "%\n• Wind: " + Math.round(wind) + " km/h");
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String weatherLabel(int code, boolean urdu) {
        if (code == 0) return urdu ? "صاف" : "Clear";
        if (code <= 2) return urdu ? "جزوی ابر" : "Partly cloudy";
        if (code <= 48) return urdu ? "ابر آلود" : "Cloudy";
        if (code <= 67 || (code >= 80 && code <= 82)) return urdu ? "بارش" : "Rain";
        return urdu ? "متغیر" : "Variable";
    }

    private Optional<String> tryWikipedia(String q, boolean urdu) {
        try {
            String topic = extractTopic(q);
            if (!hasText(topic) || topic.length() < 2) return Optional.empty();
            String lang = urdu ? "ur" : "en";
            String searchUrl = UriComponentsBuilder
                    .fromHttpUrl("https://" + lang + ".wikipedia.org/w/api.php")
                    .queryParam("action", "opensearch")
                    .queryParam("search", topic)
                    .queryParam("limit", 1)
                    .queryParam("namespace", 0)
                    .queryParam("format", "json")
                    .toUriString();
            JsonNode search = objectMapper.readTree(
                    restClientBuilder.build().get().uri(searchUrl)
                            .header("User-Agent", "RhmaniERP/1.0")
                            .retrieve().body(String.class));
            if (!search.isArray() || search.size() < 2 || !search.get(1).isArray() || search.get(1).isEmpty()) {
                if (urdu) return tryWikipedia(q, false);
                return Optional.empty();
            }
            String title = search.get(1).get(0).asText();
            String summaryUrl = "https://" + lang + ".wikipedia.org/api/rest_v1/page/summary/"
                    + URLEncoder.encode(title, StandardCharsets.UTF_8).replace("+", "%20");
            JsonNode summary = objectMapper.readTree(
                    restClientBuilder.build().get().uri(summaryUrl)
                            .header("User-Agent", "RhmaniERP/1.0")
                            .retrieve().body(String.class));
            String extract = summary.path("extract").asText("");
            if (!hasText(extract) || isJunk(extract)) return Optional.empty();
            String display = summary.path("title").asText(title);
            String pageUrl = summary.path("content_urls").path("desktop").path("page").asText("");
            StringBuilder sb = new StringBuilder();
            sb.append(urdu ? "**" + display + "** کے بارے میں:\n\n" : "About **" + display + "**:\n\n");
            sb.append(extract);
            if (hasText(pageUrl)) sb.append(urdu ? "\n\nماخذ: " : "\n\nSource: ").append(pageUrl);
            return Optional.of(sb.toString().trim());
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private Optional<String> tryDuckDuckGo(String q, boolean urdu) {
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://api.duckduckgo.com/")
                    .queryParam("q", q)
                    .queryParam("format", "json")
                    .queryParam("no_html", 1)
                    .queryParam("skip_disambig", 1)
                    .toUriString();
            JsonNode root = objectMapper.readTree(
                    restClientBuilder.build().get().uri(url)
                            .header("User-Agent", "RhmaniERP/1.0")
                            .retrieve().body(String.class));

            String answer = stripHtml(root.path("Answer").asText(""));
            String abstractText = root.path("AbstractText").asText("");
            String heading = root.path("Heading").asText("");

            // Never echo junk like "URL Decoded: <query>"
            if (hasText(answer) && !isJunk(answer) && !isEchoOfQuery(answer, q)) {
                return Optional.of((urdu ? "جواب: " : "Answer: ") + answer);
            }
            if (hasText(abstractText) && !isJunk(abstractText)) {
                String title = hasText(heading) ? heading : extractTopic(q);
                return Optional.of((urdu ? "**" + title + "**:\n\n" : "About **" + title + "**:\n\n") + abstractText);
            }

            JsonNode related = root.path("RelatedTopics");
            if (related.isArray() && !related.isEmpty()) {
                StringBuilder sb = new StringBuilder(urdu ? "متعلقہ معلومات:\n\n" : "Related information:\n\n");
                int n = 0;
                for (JsonNode t : related) {
                    String text = t.path("Text").asText("");
                    if (!hasText(text) && t.path("Topics").isArray()) {
                        for (JsonNode nested : t.path("Topics")) {
                            text = nested.path("Text").asText("");
                            if (hasText(text)) break;
                        }
                    }
                    if (!hasText(text) || isJunk(text)) continue;
                    sb.append("• ").append(text).append("\n");
                    if (++n >= 5) break;
                }
                if (n > 0) return Optional.of(sb.toString().trim());
            }
            return Optional.empty();
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private boolean isJunk(String text) {
        if (!hasText(text)) return true;
        if (JUNK_ANSWER.matcher(text).find()) return true;
        String t = text.trim();
        return t.equalsIgnoreCase("null") || t.equalsIgnoreCase("undefined");
    }

    private boolean isEchoOfQuery(String answer, String query) {
        String a = answer.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\u0600-\\u06ff ]", " ").trim();
        String q = query.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9\\u0600-\\u06ff ]", " ").trim();
        return a.contains(q) || q.contains(a) || a.replace("url decoded", "").trim().equals(q);
    }

    private String cleanAnswer(String text) {
        if (isJunk(text)) return text;
        return text.replace("\r\n", "\n").trim();
    }

    private String fallbackMessage(String q, boolean urdu) {
        if (urdu) {
            return "میں نے اس سوال کا مکمل جواب کھلے ذرائع سے نہیں ملا۔\n\n"
                    + "آپ یہ آزما سکتے ہیں:\n"
                    + "• سوال زیادہ واضح لکھیں / بولیں (مائیک)\n"
                    + "• کاروباری ڈیٹا پوچھیں: اسٹاک، فروخت، قطار، کسان/خریدار بقایا، کمیشن\n"
                    + "• موضوع کا نام سیدھا لکھیں (مثلاً: گندم، ننکانہ صاحب، کمیشن کیا ہے)";
        }
        return "I couldn't find a complete answer from open sources for that.\n\n"
                + "Try:\n"
                + "• Rephrase clearly, or use the mic to speak\n"
                + "• Ask business data: stock, sales, queue, farmer/buyer balances, commission\n"
                + "• Ask a direct topic name (e.g. wheat, Nankana Sahib, what is commission)";
    }

    private String extractTopic(String q) {
        String t = q.trim();
        t = t.replaceAll("(?i)^(please\\s+|can\\s+you\\s+|tell\\s+me\\s+|explain\\s+|what\\s+is\\s+|what\\s+are\\s+|who\\s+is\\s+|who\\s+was\\s+|where\\s+is\\s+|how\\s+does\\s+|how\\s+do\\s+|define\\s+|today\\s+)", "");
        t = t.replaceAll("[?!.]+$", "").trim();
        return t.isBlank() ? q : t;
    }

    private String stripHtml(String s) {
        return s == null ? "" : s.replaceAll("<[^>]+>", "").trim();
    }

    private String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private static final class MathParser {
        private final String s;
        private int i;

        MathParser(String s) { this.s = s; }

        BigDecimal parse() {
            BigDecimal v = parseExpr();
            if (i < s.length()) throw new IllegalArgumentException("bad expr");
            return v;
        }

        private BigDecimal parseExpr() {
            BigDecimal v = parseTerm();
            while (i < s.length() && (s.charAt(i) == '+' || s.charAt(i) == '-')) {
                char op = s.charAt(i++);
                BigDecimal r = parseTerm();
                v = op == '+' ? v.add(r) : v.subtract(r);
            }
            return v;
        }

        private BigDecimal parseTerm() {
            BigDecimal v = parsePower();
            while (i < s.length() && (s.charAt(i) == '*' || s.charAt(i) == '/' || s.charAt(i) == '%')) {
                char op = s.charAt(i++);
                BigDecimal r = parsePower();
                if (op == '*') v = v.multiply(r);
                else if (op == '%') v = v.remainder(r);
                else v = v.divide(r, 12, RoundingMode.HALF_UP);
            }
            return v;
        }

        private BigDecimal parsePower() {
            BigDecimal v = parseFactor();
            if (i < s.length() && s.charAt(i) == '^') {
                i++;
                BigDecimal exp = parsePower();
                v = BigDecimal.valueOf(Math.pow(v.doubleValue(), exp.doubleValue()))
                        .round(new MathContext(12, RoundingMode.HALF_UP));
            }
            return v;
        }

        private BigDecimal parseFactor() {
            if (i < s.length() && s.charAt(i) == '+') { i++; return parseFactor(); }
            if (i < s.length() && s.charAt(i) == '-') { i++; return parseFactor().negate(); }
            if (i < s.length() && s.charAt(i) == '(') {
                i++;
                BigDecimal v = parseExpr();
                if (i >= s.length() || s.charAt(i) != ')') throw new IllegalArgumentException(")");
                i++;
                return v;
            }
            int start = i;
            while (i < s.length() && (Character.isDigit(s.charAt(i)) || s.charAt(i) == '.')) i++;
            if (start == i) throw new IllegalArgumentException("number");
            return new BigDecimal(s.substring(start, i));
        }
    }
}
