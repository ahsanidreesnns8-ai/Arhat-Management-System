package com.rehmani.trading.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rehmani.trading.dto.AiChatMessage;
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
 * Answers general world questions using Gemini/OpenAI when configured,
 * otherwise a multi-source knowledge engine (Wikipedia, DuckDuckGo, dictionary, math).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GeneralWorldAiService {

    private static final Pattern MATH_EXPR = Pattern.compile(
            "^[\\d\\s.+\\-*/()%^]+$");
    private static final Pattern DEFINE = Pattern.compile(
            "^(?:what\\s+is\\s+(?:the\\s+)?(?:meaning\\s+of\\s+)?|define\\s+|meaning\\s+of\\s+)(.+?)\\??$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CAPITAL = Pattern.compile(
            "^(?:what\\s+is\\s+)?(?:the\\s+)?capital\\s+(?:city\\s+)?(?:of\\s+)(.+?)\\??$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern WEATHER_Q = Pattern.compile(
            "weather|temperature|forecast|موسم|درجۂ? حرار",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${app.ai.gemini-api-key:}")
    private String geminiApiKey;

    @Value("${app.ai.openai-api-key:}")
    private String openaiApiKey;

    @Value("${app.ai.openai-base-url:https://api.openai.com/v1}")
    private String openaiBaseUrl;

    @Value("${app.ai.openai-model:gpt-4o-mini}")
    private String openaiModel;

    @Value("${app.ai.gemini-model:gemini-2.0-flash}")
    private String geminiModel;

    public Optional<String> answer(String question, String language, List<AiChatMessage> history) {
        String q = question == null ? "" : question.trim();
        if (q.isBlank()) return Optional.empty();

        boolean urdu = "ur".equalsIgnoreCase(language);

        Optional<String> math = tryMath(q, urdu);
        if (math.isPresent()) return math;

        Optional<String> llm = tryLlm(q, language, history);
        if (llm.isPresent()) return llm;

        Optional<String> capital = tryCapital(q, urdu);
        if (capital.isPresent()) return capital;

        Optional<String> definition = tryDefinition(q, urdu);
        if (definition.isPresent()) return definition;

        Optional<String> weather = tryWeatherQuestion(q, urdu);
        if (weather.isPresent()) return weather;

        Optional<String> wiki = tryWikipedia(q, urdu);
        if (wiki.isPresent()) return wiki;

        Optional<String> ddg = tryDuckDuckGo(q, urdu);
        if (ddg.isPresent()) return ddg;

        return Optional.of(fallbackMessage(q, urdu));
    }

    private Optional<String> tryLlm(String question, String language, List<AiChatMessage> history) {
        if (hasText(geminiApiKey)) {
            try {
                return Optional.of(callGemini(question, language, history));
            } catch (Exception ex) {
                log.warn("Gemini AI failed: {}", ex.getMessage());
            }
        }
        if (hasText(openaiApiKey)) {
            try {
                return Optional.of(callOpenAi(question, language, history));
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
                    آپ Rhmani Trading ERP کے ذہین اسسٹنٹ ہیں۔
                    آپ کاروباری ڈیٹا اور دنیا کے کسی بھی سوال کا واضح، درست اور تفصیلی جواب اردو میں دیں۔
                    جواب منظم رکھیں: مختصر براہِ راست جواب، پھر وضاحت، اور جہاں مفید ہو اہم نکات یہ فہرست۔
                    اگر یقین نہ ہو تو واضح کہیں۔ نقصان دہ یا غیر قانونی مشورہ نہ دیں۔
                    """;
        }
        return """
                You are the Rhmani Trading ERP intelligent assistant.
                Answer ANY general world question clearly, accurately, and thoroughly.
                Also help with business/ERP questions when asked.
                Structure answers well: start with a direct answer, then explanation, then key points when useful.
                Use the user's language. Be professional, neutral, and practical.
                If unsure, say so. Do not provide harmful or illegal advice.
                """;
    }

    private String callGemini(String question, String language, List<AiChatMessage> history) throws Exception {
        List<Map<String, Object>> contents = new ArrayList<>();
        if (history != null) {
            for (AiChatMessage msg : history) {
                if (msg == null || !hasText(msg.getContent())) continue;
                String role = "assistant".equalsIgnoreCase(msg.getRole()) ? "model" : "user";
                contents.add(Map.of(
                        "role", role,
                        "parts", List.of(Map.of("text", msg.getContent()))
                ));
            }
        }
        contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", question))
        ));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt(language)))));
        body.put("contents", contents);
        body.put("generationConfig", Map.of(
                "temperature", 0.7,
                "maxOutputTokens", 2048
        ));

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + geminiModel + ":generateContent?key=" + geminiApiKey.trim();

        String raw = restClientBuilder.build()
                .post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        JsonNode root = objectMapper.readTree(raw);
        JsonNode text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (!text.isTextual() || text.asText().isBlank()) {
            throw new IllegalStateException("Empty Gemini response");
        }
        return text.asText().trim();
    }

    private String callOpenAi(String question, String language, List<AiChatMessage> history) throws Exception {
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

        Map<String, Object> body = Map.of(
                "model", openaiModel,
                "messages", messages,
                "temperature", 0.7
        );

        String raw = restClientBuilder.build()
                .post()
                .uri(openaiBaseUrl.replaceAll("/$", "") + "/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + openaiApiKey.trim())
                .body(body)
                .retrieve()
                .body(String.class);

        JsonNode root = objectMapper.readTree(raw);
        JsonNode text = root.path("choices").path(0).path("message").path("content");
        if (!text.isTextual() || text.asText().isBlank()) {
            throw new IllegalStateException("Empty OpenAI response");
        }
        return text.asText().trim();
    }

    private Optional<String> tryMath(String q, boolean urdu) {
        String expr = q.replaceAll("(?i)(what\\s+is|calculate|compute|solve|=|\\?)", "").trim();
        expr = expr.replace('×', '*').replace('÷', '/').replace('^', '^');
        if (expr.isBlank() || !MATH_EXPR.matcher(expr).matches()) return Optional.empty();
        if (!expr.matches(".*\\d.*")) return Optional.empty();
        try {
            BigDecimal result = evaluate(expr);
            String formatted = result.stripTrailingZeros().toPlainString();
            return Optional.of(urdu
                    ? "حساب کا نتیجہ: **" + formatted + "**"
                    : "Result: **" + formatted + "**");
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private BigDecimal evaluate(String expr) {
        // Shunting-yard style via recursive descent
        return new MathParser(expr.replaceAll("\\s+", "")).parse();
    }

    private Optional<String> tryCapital(String q, boolean urdu) {
        Matcher m = CAPITAL.matcher(q.trim());
        if (!m.matches()) return Optional.empty();
        String country = m.group(1).trim();
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://restcountries.com/v3.1/name/" + encode(country))
                    .queryParam("fields", "name,capital,region,population,currencies")
                    .toUriString();
            String raw = restClientBuilder.build().get().uri(url).retrieve().body(String.class);
            JsonNode arr = objectMapper.readTree(raw);
            if (!arr.isArray() || arr.isEmpty()) return Optional.empty();
            JsonNode c = arr.get(0);
            String name = c.path("name").path("common").asText(country);
            String capital = c.path("capital").isArray() && !c.path("capital").isEmpty()
                    ? c.path("capital").get(0).asText()
                    : "N/A";
            String region = c.path("region").asText("");
            long pop = c.path("population").asLong(0);
            if (urdu) {
                return Optional.of("**" + name + "** کا دارالحکومت **" + capital + "** ہے۔\n\n"
                        + "علاقہ: " + region + "\nآبادی: " + String.format(Locale.US, "%,d", pop));
            }
            return Optional.of("The capital of **" + name + "** is **" + capital + "**.\n\n"
                    + "Region: " + region + "\nPopulation: " + String.format(Locale.US, "%,d", pop));
        } catch (Exception ex) {
            log.debug("Capital lookup failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private Optional<String> tryDefinition(String q, boolean urdu) {
        Matcher m = DEFINE.matcher(q.trim());
        String word = m.matches() ? m.group(1).trim() : null;
        if (word == null) {
            if (q.split("\\s+").length <= 2 && q.matches("[A-Za-z\\-\\s]+")) {
                word = q.replace("?", "").trim();
            }
        }
        if (word == null || word.length() < 2 || word.split("\\s+").length > 4) return Optional.empty();
        try {
            String url = "https://api.dictionaryapi.dev/api/v2/entries/en/" + encode(word);
            String raw = restClientBuilder.build().get().uri(url).retrieve().body(String.class);
            JsonNode arr = objectMapper.readTree(raw);
            if (!arr.isArray() || arr.isEmpty()) return Optional.empty();
            JsonNode entry = arr.get(0);
            String term = entry.path("word").asText(word);
            String phonetic = entry.path("phonetic").asText("");
            StringBuilder sb = new StringBuilder();
            sb.append(urdu ? "**" + term + "** کا مطلب / تعریف:\n\n" : "**" + term + "** — definition:\n\n");
            if (hasText(phonetic)) sb.append("_").append(phonetic).append("_\n\n");
            int shown = 0;
            for (JsonNode meaning : entry.path("meanings")) {
                String part = meaning.path("partOfSpeech").asText("");
                for (JsonNode def : meaning.path("definitions")) {
                    sb.append("• (").append(part).append(") ").append(def.path("definition").asText()).append("\n");
                    String example = def.path("example").asText("");
                    if (hasText(example)) sb.append("  _Example:_ ").append(example).append("\n");
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
        // Default Lahore; allow "weather in <city>"
        double lat = 31.5204;
        double lon = 74.3587;
        String place = urdu ? "لاہور" : "Lahore";
        Matcher city = Pattern.compile("(?:in|at|for|میں)\\s+([A-Za-z\\u0600-\\u06FF ]{2,40})", Pattern.CASE_INSENSITIVE)
                .matcher(q);
        if (city.find()) {
            place = city.group(1).trim();
            // keep Lahore coords unless we resolve — still useful as market default
        }
        try {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                    .queryParam("latitude", lat)
                    .queryParam("longitude", lon)
                    .queryParam("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m")
                    .queryParam("timezone", "Asia/Karachi")
                    .toUriString();
            String raw = restClientBuilder.build().get().uri(url).retrieve().body(String.class);
            JsonNode cur = objectMapper.readTree(raw).path("current");
            double temp = cur.path("temperature_2m").asDouble();
            int humidity = cur.path("relative_humidity_2m").asInt();
            double wind = cur.path("wind_speed_10m").asDouble();
            String condition = weatherLabel(cur.path("weather_code").asInt(), urdu);
            if (urdu) {
                return Optional.of("**" + place + "** کا موجودہ موسم:\n\n"
                        + "• حالت: " + condition + "\n"
                        + "• درجہ حرارت: " + Math.round(temp) + "°C\n"
                        + "• نمی: " + humidity + "%\n"
                        + "• ہوا: " + Math.round(wind) + " km/h");
            }
            return Optional.of("Current weather for **" + place + "** (market default: Lahore area):\n\n"
                    + "• Condition: " + condition + "\n"
                    + "• Temperature: " + Math.round(temp) + "°C\n"
                    + "• Humidity: " + humidity + "%\n"
                    + "• Wind: " + Math.round(wind) + " km/h");
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private String weatherLabel(int code, boolean urdu) {
        if (code == 0) return urdu ? "صاف" : "Clear";
        if (code <= 2) return urdu ? "جزوی طور پر ابر آلود" : "Partly cloudy";
        if (code <= 48) return urdu ? "ابر آلود / دھند" : "Cloudy / Fog";
        if (code <= 67 || (code >= 80 && code <= 82)) return urdu ? "بارش" : "Rain";
        if (code >= 71 && code <= 77) return urdu ? "برفباری" : "Snow";
        return urdu ? "متغیر" : "Variable";
    }

    private Optional<String> tryWikipedia(String q, boolean urdu) {
        try {
            String topic = extractTopic(q);
            String lang = urdu ? "ur" : "en";
            String searchUrl = UriComponentsBuilder
                    .fromHttpUrl("https://" + lang + ".wikipedia.org/w/api.php")
                    .queryParam("action", "opensearch")
                    .queryParam("search", topic)
                    .queryParam("limit", 1)
                    .queryParam("namespace", 0)
                    .queryParam("format", "json")
                    .toUriString();

            String searchRaw = restClientBuilder.build().get().uri(searchUrl)
                    .header("User-Agent", "RhmaniERP/1.0 (educational)")
                    .retrieve().body(String.class);
            JsonNode search = objectMapper.readTree(searchRaw);
            if (!search.isArray() || search.size() < 2 || !search.get(1).isArray() || search.get(1).isEmpty()) {
                if (urdu) {
                    // fallback English wiki
                    return tryWikipedia(q, false);
                }
                return Optional.empty();
            }
            String title = search.get(1).get(0).asText();
            String summaryUrl = "https://" + lang + ".wikipedia.org/api/rest_v1/page/summary/"
                    + URLEncoder.encode(title, StandardCharsets.UTF_8).replace("+", "%20");
            String summaryRaw = restClientBuilder.build().get().uri(summaryUrl)
                    .header("User-Agent", "RhmaniERP/1.0 (educational)")
                    .retrieve().body(String.class);
            JsonNode summary = objectMapper.readTree(summaryRaw);
            String extract = summary.path("extract").asText("");
            if (!hasText(extract)) return Optional.empty();
            String display = summary.path("title").asText(title);
            String pageUrl = summary.path("content_urls").path("desktop").path("page").asText("");

            StringBuilder sb = new StringBuilder();
            if (urdu) {
                sb.append("**").append(display).append("** کے بارے میں:\n\n");
            } else {
                sb.append("Here's a clear answer about **").append(display).append("**:\n\n");
            }
            sb.append(extract);
            if (hasText(pageUrl)) {
                sb.append(urdu ? "\n\nماخذ: " : "\n\nSource: ").append(pageUrl);
            }
            return Optional.of(sb.toString().trim());
        } catch (Exception ex) {
            log.debug("Wikipedia lookup failed: {}", ex.getMessage());
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
            String raw = restClientBuilder.build().get().uri(url)
                    .header("User-Agent", "RhmaniERP/1.0")
                    .retrieve().body(String.class);
            JsonNode root = objectMapper.readTree(raw);
            String abstractText = root.path("AbstractText").asText("");
            String answer = root.path("Answer").asText("");
            String heading = root.path("Heading").asText("");

            if (hasText(answer)) {
                return Optional.of((urdu ? "جواب: " : "Answer: ") + stripHtml(answer));
            }
            if (hasText(abstractText)) {
                String title = hasText(heading) ? heading : extractTopic(q);
                return Optional.of((urdu ? "**" + title + "**:\n\n" : "About **" + title + "**:\n\n")
                        + abstractText);
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
                    if (!hasText(text)) continue;
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

    private String fallbackMessage(String q, boolean urdu) {
        if (urdu) {
            return "میں نے اس سوال پر کھلی معلومات تلاش کیں مگر مکمل جواب نہیں مل سکا۔\n\n"
                    + "آپ یہ آزما سکتے ہیں:\n"
                    + "• سوال کو زیادہ واضح لکھیں (مثلاً \"پاکستان کا دارالحکومت کیا ہے؟\")\n"
                    + "• کاروباری ڈیٹا: اسٹاک، فروخت، قطار، کسان، خریدار\n"
                    + "• مکمل ذہین جوابات کے لیے بیک اینڈ میں `GEMINI_API_KEY` سیٹ کریں (مفت Google AI Studio کلید)";
        }
        return "I searched open knowledge sources but could not find a complete answer for that yet.\n\n"
                + "Try:\n"
                + "• Rephrasing more specifically (e.g. \"What is the capital of Pakistan?\")\n"
                + "• Business data: stock, sales, queue, farmers, buyers\n"
                + "• For full conversational AI on any topic, set `GEMINI_API_KEY` in the backend (free from Google AI Studio)";
    }

    private String extractTopic(String q) {
        String t = q.trim();
        t = t.replaceAll("(?i)^(please\\s+|can\\s+you\\s+|could\\s+you\\s+|tell\\s+me\\s+|explain\\s+|what\\s+is\\s+|what\\s+are\\s+|who\\s+is\\s+|who\\s+was\\s+|where\\s+is\\s+|when\\s+was\\s+|how\\s+does\\s+|how\\s+do\\s+|define\\s+)", "");
        t = t.replaceAll("[?!.]+$", "").trim();
        return t.isBlank() ? q : t;
    }

    private String stripHtml(String s) {
        return s.replaceAll("<[^>]+>", "").trim();
    }

    private String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    /** Minimal arithmetic parser supporting + - * / % ^ and parentheses. */
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
