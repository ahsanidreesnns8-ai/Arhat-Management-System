package com.rehmani.trading.service;

import com.rehmani.trading.entity.*;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BillService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final String LOCATION_EN = "Gala Mandi Nankana Sahib";
    private static final String LOCATION_UR = "گالا منڈی ننکانہ صاحب";

    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final DheriRepository dheriRepository;
    private final SaleRepository saleRepository;
    private final PaymentRepository paymentRepository;
    private final BusinessSettingsRepository settingsRepository;

    public String generateFarmerBillHtml(Long farmerId, String lang) {
        boolean urdu = isUrdu(lang);
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(farmerId)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        List<Dheri> dheris = dheriRepository.findByFarmerIdWithDetails(farmerId);
        BusinessSettings settings = getSettings();
        Map<String, String> t = labels(urdu);

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalCommission = BigDecimal.ZERO;
        BigDecimal totalPayable = BigDecimal.ZERO;
        StringBuilder rows = new StringBuilder();

        for (Dheri d : dheris) {
            BigDecimal gross = safe(d.getTotalPrice());
            BigDecimal commission = safe(d.getCommissionAmount());
            BigDecimal payable = safe(d.getFarmerReceivable());
            totalGross = totalGross.add(gross);
            totalCommission = totalCommission.add(commission);
            totalPayable = totalPayable.add(payable);

            String dateStr = d.getCreatedAt() != null
                    ? d.getCreatedAt().toLocalDate().format(DATE_FMT)
                    : LocalDate.now().format(DATE_FMT);

            rows.append("<tr>")
                    .append(td(dateStr))
                    .append(td(d.getDheriId()))
                    .append(td(d.getProduct() != null ? d.getProduct().getName() : ""))
                    .append(td(String.valueOf(d.getNumberOfBags())))
                    .append(td(money(d.getTotalWeight())))
                    .append(td(money(d.getMarketRate())))
                    .append(td(money(gross)))
                    .append(td(money(commission) + " (" + money(d.getCommissionPercentage()) + "%)"))
                    .append(td(money(payable)))
                    .append("</tr>");
        }

        BigDecimal paid = sumFarmerPayments(farmerId);
        BigDecimal remaining = safe(farmer.getOutstandingBalance());

        String partyBlock = partyBlock(
                t.get("farmer"),
                farmer.getName(),
                farmer.getFarmerId(),
                farmer.getPhone(),
                farmer.getCity() != null ? farmer.getCity() : farmer.getAddress(),
                urdu
        );

        String body = partyBlock
                + "<table><thead><tr>"
                + th(t.get("date")) + th(t.get("dheri")) + th(t.get("product"))
                + th(t.get("bags")) + th(t.get("weight")) + th(t.get("rate"))
                + th(t.get("gross")) + th(t.get("commission4")) + th(t.get("payable"))
                + "</tr></thead><tbody>" + rows + "</tbody>"
                + "<tfoot>"
                + "<tr><td colspan='6'><strong>" + t.get("totals") + "</strong></td>"
                + "<td><strong>" + money(totalGross) + "</strong></td>"
                + "<td><strong>" + money(totalCommission) + "</strong></td>"
                + "<td><strong>" + money(totalPayable) + "</strong></td></tr>"
                + "<tr><td colspan='8'>" + t.get("paid") + "</td><td><strong>" + money(paid) + "</strong></td></tr>"
                + "<tr><td colspan='8'>" + t.get("remaining") + "</td><td><strong>" + money(remaining) + "</strong></td></tr>"
                + "</tfoot></table>"
                + "<p class='note'>" + t.get("commissionNote") + "</p>";

        return buildReceiptHtml(settings, t.get("farmerBill"), body, urdu);
    }

    public String generateBuyerBillHtml(Long buyerId, String lang) {
        boolean urdu = isUrdu(lang);
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(buyerId)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        List<Sale> sales = saleRepository.findByBuyerIdWithItems(buyerId);
        BusinessSettings settings = getSettings();
        Map<String, String> t = labels(urdu);

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;
        StringBuilder rows = new StringBuilder();

        for (Sale s : sales) {
            totalAmount = totalAmount.add(safe(s.getTotalAmount()));
            totalPaid = totalPaid.add(safe(s.getPaidAmount()));
            String saleDate = s.getSaleDate() != null ? s.getSaleDate().format(DATE_FMT) : "";

            if (s.getItems() == null || s.getItems().isEmpty()) {
                rows.append("<tr>")
                        .append(td(saleDate))
                        .append(td(s.getInvoiceNumber()))
                        .append(td("—"))
                        .append(td("—"))
                        .append(td(String.valueOf(s.getTotalBags())))
                        .append(td(money(s.getTotalWeight())))
                        .append(td("—"))
                        .append(td(money(s.getTotalAmount())))
                        .append("</tr>");
                continue;
            }

            for (SaleItem item : s.getItems()) {
                String dheriCode = item.getDheri() != null ? item.getDheri().getDheriId() : "—";
                String productName = item.getProduct() != null ? item.getProduct().getName() : "—";
                rows.append("<tr>")
                        .append(td(saleDate))
                        .append(td(s.getInvoiceNumber()))
                        .append(td(productName))
                        .append(td(dheriCode))
                        .append(td(String.valueOf(item.getNumberOfBags())))
                        .append(td(money(item.getTotalWeight())))
                        .append(td(money(item.getRate())))
                        .append(td(money(item.getAmount())))
                        .append("</tr>");
            }
        }

        BigDecimal remaining = safe(buyer.getOutstandingBalance());

        String partyBlock = partyBlock(
                t.get("buyer"),
                buyer.getName(),
                buyer.getBuyerId(),
                buyer.getPhone(),
                buyer.getCity() != null ? buyer.getCity() : buyer.getAddress(),
                urdu
        );

        String body = partyBlock
                + "<p class='sub'>" + t.get("buyerTxnNote") + "</p>"
                + "<table><thead><tr>"
                + th(t.get("date")) + th(t.get("invoice")) + th(t.get("product")) + th(t.get("dheri"))
                + th(t.get("bags")) + th(t.get("weight")) + th(t.get("rate")) + th(t.get("amount"))
                + "</tr></thead><tbody>" + rows + "</tbody>"
                + "<tfoot>"
                + "<tr><td colspan='7'><strong>" + t.get("totalBilled") + "</strong></td><td><strong>" + money(totalAmount) + "</strong></td></tr>"
                + "<tr><td colspan='7'><strong>" + t.get("paid") + "</strong></td><td><strong>" + money(totalPaid) + "</strong></td></tr>"
                + "<tr><td colspan='7'><strong>" + t.get("remaining") + "</strong></td><td><strong>" + money(remaining) + "</strong></td></tr>"
                + "</tfoot></table>";

        return buildReceiptHtml(settings, t.get("buyerBill"), body, urdu);
    }

    public String generateSaleFarmerBillHtml(Long saleId, String lang) {
        boolean urdu = isUrdu(lang);
        Sale sale = findSale(saleId);
        BusinessSettings settings = getSettings();
        Map<String, String> t = labels(urdu);
        String saleDate = sale.getSaleDate() != null ? sale.getSaleDate().format(DATE_FMT) : "";

        StringBuilder rows = new StringBuilder();
        BigDecimal total = BigDecimal.ZERO;
        List<SaleItem> farmerItems = sale.getItems() != null ? sale.getItems() : List.of();
        for (SaleItem item : farmerItems) {
            if (item.getSourceType() != SaleSourceType.FARMER || item.getFarmer() == null) continue;
            total = total.add(safe(item.getAmount()));
            rows.append("<tr>")
                    .append(td(saleDate))
                    .append(td(item.getFarmer().getName()))
                    .append(td(item.getProduct() != null ? item.getProduct().getName() : ""))
                    .append(td(item.getDheri() != null ? item.getDheri().getDheriId() : "—"))
                    .append(td(String.valueOf(item.getNumberOfBags())))
                    .append(td(money(item.getTotalWeight())))
                    .append(td(money(item.getRate())))
                    .append(td(money(item.getAmount())))
                    .append("</tr>");
        }

        String body = "<p><strong>" + t.get("invoice") + ":</strong> " + escape(sale.getInvoiceNumber()) + "</p>"
                + "<table><thead><tr>"
                + th(t.get("date")) + th(t.get("farmer")) + th(t.get("product")) + th(t.get("dheri"))
                + th(t.get("bags")) + th(t.get("weight")) + th(t.get("rate")) + th(t.get("amount"))
                + "</tr></thead><tbody>" + rows + "</tbody>"
                + "<tfoot><tr><td colspan='7'><strong>" + t.get("totals") + "</strong></td>"
                + "<td><strong>" + money(total) + "</strong></td></tr></tfoot></table>";

        return buildReceiptHtml(settings, t.get("farmerBill"), body, urdu);
    }

    public String generateSaleBuyerBillHtml(Long saleId, String lang) {
        boolean urdu = isUrdu(lang);
        Sale sale = findSale(saleId);
        BusinessSettings settings = getSettings();
        Map<String, String> t = labels(urdu);
        Buyer buyer = sale.getBuyer();
        if (buyer == null) {
            throw new RuntimeException("Sale has no buyer");
        }

        StringBuilder rows = new StringBuilder();
        String saleDate = sale.getSaleDate() != null ? sale.getSaleDate().format(DATE_FMT) : "";
        List<SaleItem> items = sale.getItems() != null ? sale.getItems() : List.of();
        for (SaleItem item : items) {
            rows.append("<tr>")
                    .append(td(saleDate))
                    .append(td(item.getProduct() != null ? item.getProduct().getName() : ""))
                    .append(td(item.getDheri() != null ? item.getDheri().getDheriId() : "—"))
                    .append(td(String.valueOf(item.getNumberOfBags())))
                    .append(td(money(item.getTotalWeight())))
                    .append(td(money(item.getRate())))
                    .append(td(money(item.getAmount())))
                    .append("</tr>");
        }

        String partyBlock = partyBlock(
                t.get("buyer"),
                buyer.getName(),
                buyer.getBuyerId(),
                buyer.getPhone(),
                buyer.getCity(),
                urdu
        );

        String body = partyBlock
                + "<p><strong>" + t.get("invoice") + ":</strong> " + escape(sale.getInvoiceNumber()) + "</p>"
                + "<table><thead><tr>"
                + th(t.get("date")) + th(t.get("product")) + th(t.get("dheri"))
                + th(t.get("bags")) + th(t.get("weight")) + th(t.get("rate")) + th(t.get("amount"))
                + "</tr></thead><tbody>" + rows + "</tbody>"
                + "<tfoot>"
                + "<tr><td colspan='6'><strong>" + t.get("totalBilled") + "</strong></td><td><strong>" + money(sale.getTotalAmount()) + "</strong></td></tr>"
                + "<tr><td colspan='6'><strong>" + t.get("paid") + "</strong></td><td><strong>" + money(sale.getPaidAmount()) + "</strong></td></tr>"
                + "</tfoot></table>";

        return buildReceiptHtml(settings, t.get("buyerBill"), body, urdu);
    }

    public String generateFarmerBillHtml(Long farmerId) {
        return generateFarmerBillHtml(farmerId, "en");
    }

    public String generateBuyerBillHtml(Long buyerId) {
        return generateBuyerBillHtml(buyerId, "en");
    }

    public String generateSaleFarmerBillHtml(Long saleId) {
        return generateSaleFarmerBillHtml(saleId, "en");
    }

    public String generateSaleBuyerBillHtml(Long saleId) {
        return generateSaleBuyerBillHtml(saleId, "en");
    }

    public byte[] generateFarmerBillPdf(Long farmerId) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(farmerId)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        String html = generateFarmerBillHtml(farmerId, "en");
        return htmlToPdf("Farmer Bill - " + farmer.getName(), html);
    }

    public byte[] generateBuyerBillPdf(Long buyerId) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(buyerId)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        String html = generateBuyerBillHtml(buyerId, "en");
        return htmlToPdf("Buyer Bill - " + buyer.getName(), html);
    }

    private BigDecimal sumFarmerPayments(Long farmerId) {
        return paymentRepository.findByFarmerIdOrderByPaymentDateDesc(farmerId).stream()
                .map(p -> safe(p.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Sale findSale(Long saleId) {
        return saleRepository.findByIdWithDetails(saleId)
                .orElseThrow(() -> new RuntimeException("Sale not found"));
    }

    private BusinessSettings getSettings() {
        return settingsRepository.findAll().stream()
                .findFirst()
                .orElse(BusinessSettings.builder().build());
    }

    private String buildReceiptHtml(BusinessSettings settings, String title, String body, boolean urdu) {
        String company = settings.getCompanyName() != null ? settings.getCompanyName() : "Rehmani Trading Company";
        String logoDataUri = logoDataUri(settings);
        String dir = urdu ? "rtl" : "ltr";
        String font = urdu
                ? "'Noto Nastaliq Urdu', 'Segoe UI', Tahoma, sans-serif"
                : "'Segoe UI', Arial, sans-serif";
        String location = urdu ? LOCATION_UR : LOCATION_EN;

        return "<!DOCTYPE html><html lang='" + (urdu ? "ur" : "en") + "' dir='" + dir + "'><head>"
                + "<meta charset='UTF-8'><title>" + escape(title) + "</title>"
                + "<link href='https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap' rel='stylesheet'>"
                + "<style>"
                + "body{font-family:" + font + ";margin:0;padding:32px;color:#0f172a;background:#fff}"
                + ".sheet{max-width:860px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:28px 32px;"
                + "box-shadow:0 8px 30px rgba(0,45,98,0.08)}"
                + ".brand{text-align:center;border-bottom:3px solid #002D62;padding-bottom:18px;margin-bottom:22px}"
                + ".brand img{max-height:110px;width:auto;display:block;margin:0 auto 10px}"
                + ".brand h1{margin:0;color:#002D62;font-size:26px;letter-spacing:0.04em}"
                + ".brand .title{margin-top:6px;color:#C5A059;font-weight:700;font-size:15px}"
                + ".meta{color:#64748b;font-size:13px;margin-top:8px}"
                + ".party{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:18px}"
                + ".party h3{margin:0 0 8px;color:#002D62;font-size:16px}"
                + ".party p{margin:3px 0;font-size:14px}"
                + ".sub{color:#64748b;font-size:13px;margin:0 0 12px}"
                + "table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}"
                + "th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:" + (urdu ? "right" : "left") + "}"
                + "th{background:#002D62;color:#fff;font-weight:600}"
                + "tfoot td{background:#f1f5f9}"
                + ".note{margin-top:14px;font-size:12px;color:#64748b}"
                + ".footer{margin-top:28px;padding-top:14px;border-top:2px solid #C5A059;text-align:center}"
                + ".footer .loc{font-size:15px;font-weight:700;color:#002D62}"
                + ".footer .phone{font-size:13px;color:#64748b;margin-top:4px}"
                + "@media print{body{padding:0}.sheet{box-shadow:none;border:none}}"
                + "</style></head><body><div class='sheet'>"
                + "<div class='brand'>"
                + (logoDataUri != null ? "<img src='" + logoDataUri + "' alt='Logo'/>" : "")
                + "<h1>" + escape(company) + "</h1>"
                + "<div class='title'>" + escape(title) + "</div>"
                + "<div class='meta'>" + (urdu ? "تاریخ" : "Date") + ": " + LocalDate.now().format(DATE_FMT) + "</div>"
                + "</div>"
                + body
                + "<div class='footer'>"
                + "<div class='loc'>" + escape(location) + "</div>"
                + (settings.getPhone() != null ? "<div class='phone'>" + (urdu ? "فون" : "Phone") + ": "
                + escape(settings.getPhone()) + "</div>" : "")
                + "</div></div></body></html>";
    }

    private String partyBlock(String roleLabel, String name, String code, String phone, String city, boolean urdu) {
        return "<div class='party'><h3>" + escape(roleLabel) + "</h3>"
                + "<p><strong>" + (urdu ? "نام" : "Name") + ":</strong> " + escape(name) + "</p>"
                + "<p><strong>" + (urdu ? "آئی ڈی" : "ID") + ":</strong> " + escape(code) + "</p>"
                + (phone != null && !phone.isBlank() ? "<p><strong>" + (urdu ? "فون" : "Phone") + ":</strong> "
                + escape(phone) + "</p>" : "")
                + (city != null && !city.isBlank() ? "<p><strong>" + (urdu ? "شہر" : "City") + ":</strong> "
                + escape(city) + "</p>" : "")
                + "</div>";
    }

    private Map<String, String> labels(boolean urdu) {
        Map<String, String> m = new HashMap<>();
        if (urdu) {
            m.put("farmerBill", "کسان بل / ادائیگی رسید");
            m.put("buyerBill", "خریدار بل / ادائیگی رسید");
            m.put("farmer", "کسان کی تفصیل");
            m.put("buyer", "خریدار کی تفصیل");
            m.put("date", "تاریخ");
            m.put("dheri", "ڈھیری");
            m.put("product", "پروڈکٹ");
            m.put("bags", "بوریاں");
            m.put("weight", "وزن (کلو)");
            m.put("rate", "ریٹ / 40 کلو");
            m.put("gross", "کل رقم");
            m.put("commission4", "کمیشن 4%");
            m.put("payable", "قابل ادائیگی");
            m.put("amount", "رقم");
            m.put("invoice", "انوائس");
            m.put("totals", "کل");
            m.put("totalBilled", "کل بل");
            m.put("paid", "ادا شدہ");
            m.put("remaining", "باقی رقم");
            m.put("commissionNote", "کسان بل میں کل رقم سے 4% کمیشن کاٹا گیا ہے۔");
            m.put("buyerTxnNote", "ہر خریداری کی تاریخ اور ریٹ الگ درج ہیں۔ مختلف ریٹ ممکن ہیں۔");
        } else {
            m.put("farmerBill", "Farmer Bill / Payment Receipt");
            m.put("buyerBill", "Buyer Bill / Payment Receipt");
            m.put("farmer", "Farmer Details");
            m.put("buyer", "Buyer Details");
            m.put("date", "Date");
            m.put("dheri", "Dheri");
            m.put("product", "Product");
            m.put("bags", "Bags");
            m.put("weight", "Weight (kg)");
            m.put("rate", "Rate / 40kg");
            m.put("gross", "Gross Amount");
            m.put("commission4", "Commission 4%");
            m.put("payable", "Payable");
            m.put("amount", "Amount");
            m.put("invoice", "Invoice");
            m.put("totals", "Totals");
            m.put("totalBilled", "Total Billed");
            m.put("paid", "Paid");
            m.put("remaining", "Remaining");
            m.put("commissionNote", "Farmer bill deducts 4% commission from the gross amount.");
            m.put("buyerTxnNote", "Each purchase is listed with its own date and rate. Rates may differ per transaction.");
        }
        return m;
    }

    private String logoDataUri(BusinessSettings settings) {
        try {
            ClassPathResource resource = new ClassPathResource("static/rehmani-logo.svg");
            if (resource.exists()) {
                byte[] bytes = normalizeSvgUtf8(StreamUtils.copyToByteArray(resource.getInputStream()));
                return "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(bytes);
            }
        } catch (Exception ignored) {
            // fall through
        }
        String url = settings.getCompanyLogoUrl();
        if (url != null && !url.isBlank()) {
            return escape(url);
        }
        return null;
    }

    /** Fix legacy Latin-1 middle-dots (0xB7) that break SVG as UTF-8 in browsers. */
    private byte[] normalizeSvgUtf8(byte[] bytes) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(bytes.length + 32);
        for (int i = 0; i < bytes.length; i++) {
            int b = bytes[i] & 0xFF;
            // Lone Latin-1 middot — not already part of UTF-8 C2 B7
            if (b == 0xB7 && (i == 0 || (bytes[i - 1] & 0xFF) != 0xC2)) {
                out.write(0xC2);
                out.write(0xB7);
            } else {
                out.write(b);
            }
        }
        String svg = out.toString(java.nio.charset.StandardCharsets.UTF_8);
        if (!svg.contains("encoding=")) {
            svg = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" + svg;
        }
        return svg.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private boolean isUrdu(String lang) {
        return lang != null && (lang.equalsIgnoreCase("ur") || lang.equalsIgnoreCase("urdu"));
    }

    private String th(String text) {
        return "<th>" + escape(text) + "</th>";
    }

    private String td(String text) {
        return "<td>" + escape(text) + "</td>";
    }

    private String money(BigDecimal value) {
        return safe(value).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private BigDecimal safe(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private byte[] htmlToPdf(String title, String html) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

            try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                cs.beginText();
                cs.setFont(fontBold, 14);
                cs.newLineAtOffset(50, 780);
                cs.showText(sanitizePdfText(title));
                cs.endText();

                String plain = html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
                if (plain.length() > 3000) {
                    plain = plain.substring(0, 3000) + "...";
                }

                float y = 750;
                cs.setFont(font, 10);
                for (String line : wrapText(plain, 90)) {
                    if (y < 50) break;
                    cs.beginText();
                    cs.newLineAtOffset(50, y);
                    cs.showText(sanitizePdfText(line));
                    cs.endText();
                    y -= 14;
                }
            }

            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate PDF", e);
        }
    }

    private List<String> wrapText(String text, int maxLen) {
        java.util.ArrayList<String> lines = new java.util.ArrayList<>();
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + maxLen, text.length());
            if (end < text.length()) {
                int space = text.lastIndexOf(' ', end);
                if (space > start) end = space;
            }
            lines.add(text.substring(start, end).trim());
            start = end;
            while (start < text.length() && text.charAt(start) == ' ') start++;
        }
        return lines;
    }

    private String sanitizePdfText(String text) {
        return text.replaceAll("[^\\x20-\\x7E]", "?");
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
