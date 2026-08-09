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
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BillService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final DheriRepository dheriRepository;
    private final SaleRepository saleRepository;
    private final BusinessSettingsRepository settingsRepository;

    public String generateFarmerBillHtml(Long farmerId) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(farmerId)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        List<Dheri> dheris = dheriRepository.findByFarmerIdWithDetails(farmerId);
        BusinessSettings settings = getSettings();

        StringBuilder rows = new StringBuilder();
        BigDecimal totalReceivable = BigDecimal.ZERO;
        for (Dheri d : dheris) {
            totalReceivable = totalReceivable.add(d.getFarmerReceivable());
            rows.append("<tr>")
                    .append("<td>").append(escape(d.getDheriId())).append("</td>")
                    .append("<td>").append(escape(d.getProduct().getName())).append("</td>")
                    .append("<td>").append(d.getNumberOfBags()).append("</td>")
                    .append("<td>").append(d.getTotalWeight()).append("</td>")
                    .append("<td>").append(d.getMarketRate()).append("</td>")
                    .append("<td>").append(d.getCommissionAmount()).append("</td>")
                    .append("<td>").append(d.getFarmerReceivable()).append("</td>")
                    .append("</tr>");
        }

        return buildHtml(settings, "Farmer Bill",
                "Farmer: " + farmer.getName() + " (" + farmer.getFarmerId() + ")",
                "<table><thead><tr><th>Dheri</th><th>Product</th><th>Bags</th><th>Weight</th><th>Rate</th><th>Commission</th><th>Receivable</th></tr></thead><tbody>"
                        + rows + "</tbody><tfoot><tr><td colspan='6'><strong>Total Receivable</strong></td><td><strong>"
                        + totalReceivable + "</strong></td></tr></tfoot></table>");
    }

    public String generateBuyerBillHtml(Long buyerId) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(buyerId)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        List<Sale> sales = saleRepository.findByBuyerId(buyerId);
        BusinessSettings settings = getSettings();

        StringBuilder rows = new StringBuilder();
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;
        for (Sale s : sales) {
            totalAmount = totalAmount.add(s.getTotalAmount());
            totalPaid = totalPaid.add(s.getPaidAmount());
            rows.append("<tr>")
                    .append("<td>").append(escape(s.getInvoiceNumber())).append("</td>")
                    .append("<td>").append(s.getSaleDate().format(DATE_FMT)).append("</td>")
                    .append("<td>").append(s.getTotalBags()).append("</td>")
                    .append("<td>").append(s.getTotalWeight()).append("</td>")
                    .append("<td>").append(s.getTotalAmount()).append("</td>")
                    .append("<td>").append(s.getPaidAmount()).append("</td>")
                    .append("<td>").append(s.getPaymentStatus()).append("</td>")
                    .append("</tr>");
        }

        return buildHtml(settings, "Buyer Bill",
                "Buyer: " + buyer.getName() + " (" + buyer.getBuyerId() + ")",
                "<table><thead><tr><th>Invoice</th><th>Date</th><th>Bags</th><th>Weight</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead><tbody>"
                        + rows + "</tbody><tfoot><tr><td colspan='4'><strong>Totals</strong></td><td><strong>"
                        + totalAmount + "</strong></td><td><strong>" + totalPaid + "</strong></td><td></td></tr></tfoot></table>");
    }

    public String generateSaleFarmerBillHtml(Long saleId) {
        Sale sale = findSale(saleId);
        BusinessSettings settings = getSettings();

        StringBuilder rows = new StringBuilder();
        for (SaleItem item : sale.getItems()) {
            if (item.getSourceType() != SaleSourceType.FARMER || item.getFarmer() == null) {
                continue;
            }
            rows.append("<tr>")
                    .append("<td>").append(escape(item.getFarmer().getName())).append("</td>")
                    .append("<td>").append(escape(item.getProduct().getName())).append("</td>")
                    .append("<td>").append(item.getNumberOfBags()).append("</td>")
                    .append("<td>").append(item.getTotalWeight()).append("</td>")
                    .append("<td>").append(item.getRate()).append("</td>")
                    .append("<td>").append(item.getAmount()).append("</td>")
                    .append("</tr>");
        }

        return buildHtml(settings, "Sale Farmer Bill",
                "Invoice: " + sale.getInvoiceNumber() + " | Date: " + sale.getSaleDate().format(DATE_FMT),
                "<table><thead><tr><th>Farmer</th><th>Product</th><th>Bags</th><th>Weight</th><th>Rate</th><th>Amount</th></tr></thead><tbody>"
                        + rows + "</tbody></table>");
    }

    public String generateSaleBuyerBillHtml(Long saleId) {
        Sale sale = findSale(saleId);
        BusinessSettings settings = getSettings();
        Buyer buyer = sale.getBuyer();

        StringBuilder rows = new StringBuilder();
        for (SaleItem item : sale.getItems()) {
            rows.append("<tr>")
                    .append("<td>").append(escape(item.getProduct().getName())).append("</td>")
                    .append("<td>").append(item.getNumberOfBags()).append("</td>")
                    .append("<td>").append(item.getTotalWeight()).append("</td>")
                    .append("<td>").append(item.getRate()).append("</td>")
                    .append("<td>").append(item.getAmount()).append("</td>")
                    .append("</tr>");
        }

        return buildHtml(settings, "Sale Invoice",
                "Buyer: " + buyer.getName() + " (" + buyer.getBuyerId() + ") | Invoice: " + sale.getInvoiceNumber(),
                "<table><thead><tr><th>Product</th><th>Bags</th><th>Weight</th><th>Rate</th><th>Amount</th></tr></thead><tbody>"
                        + rows + "</tbody><tfoot><tr><td colspan='4'><strong>Total</strong></td><td><strong>"
                        + sale.getTotalAmount() + "</strong></td></tr><tr><td colspan='4'><strong>Paid</strong></td><td><strong>"
                        + sale.getPaidAmount() + "</strong></td></tr></tfoot></table>");
    }

    public byte[] generateFarmerBillPdf(Long farmerId) {
        Farmer farmer = farmerRepository.findByIdAndDeletedFalse(farmerId)
                .orElseThrow(() -> new RuntimeException("Farmer not found"));
        String html = generateFarmerBillHtml(farmerId);
        return htmlToPdf("Farmer Bill - " + farmer.getName(), html);
    }

    public byte[] generateBuyerBillPdf(Long buyerId) {
        Buyer buyer = buyerRepository.findByIdAndDeletedFalse(buyerId)
                .orElseThrow(() -> new RuntimeException("Buyer not found"));
        String html = generateBuyerBillHtml(buyerId);
        return htmlToPdf("Buyer Bill - " + buyer.getName(), html);
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

    private String buildHtml(BusinessSettings settings, String title, String subtitle, String body) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>" + escape(title) + "</title>"
                + "<style>body{font-family:Arial,sans-serif;margin:40px;color:#222}"
                + ".header{border-bottom:3px solid #1a5f2a;padding-bottom:16px;margin-bottom:24px}"
                + "h1{color:#1a5f2a;margin:0}h2{font-weight:normal;color:#555;margin:8px 0 0}"
                + "table{width:100%;border-collapse:collapse;margin-top:20px}"
                + "th,td{border:1px solid #ccc;padding:8px;text-align:left}"
                + "th{background:#f0f7f1}</style></head><body>"
                + "<div class='header'><h1>" + escape(settings.getCompanyName()) + "</h1>"
                + "<h2>" + escape(title) + "</h2>"
                + (settings.getAddress() != null ? "<p>" + escape(settings.getAddress()) + "</p>" : "")
                + (settings.getPhone() != null ? "<p>Phone: " + escape(settings.getPhone()) + "</p>" : "")
                + "</div><p><strong>" + escape(subtitle) + "</strong></p>"
                + "<p>Date: " + LocalDate.now().format(DATE_FMT) + "</p>"
                + body + "</body></html>";
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
