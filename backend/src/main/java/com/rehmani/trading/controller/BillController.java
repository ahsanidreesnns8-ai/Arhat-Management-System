package com.rehmani.trading.controller;

import com.rehmani.trading.service.BillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/bills")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;

    @GetMapping(
            value = "/farmer/{farmerId}",
            produces = { MediaType.TEXT_HTML_VALUE, MediaType.ALL_VALUE }
    )
    public ResponseEntity<String> farmerBill(
            @PathVariable Long farmerId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return html(billService.generateFarmerBillHtml(farmerId, lang));
    }

    @GetMapping(
            value = "/buyer/{buyerId}",
            produces = { MediaType.TEXT_HTML_VALUE, MediaType.ALL_VALUE }
    )
    public ResponseEntity<String> buyerBill(
            @PathVariable Long buyerId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return html(billService.generateBuyerBillHtml(buyerId, lang));
    }

    @GetMapping(
            value = "/sale/{saleId}/farmer",
            produces = { MediaType.TEXT_HTML_VALUE, MediaType.ALL_VALUE }
    )
    public ResponseEntity<String> saleFarmerBill(
            @PathVariable Long saleId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return html(billService.generateSaleFarmerBillHtml(saleId, lang));
    }

    @GetMapping(
            value = "/sale/{saleId}/buyer",
            produces = { MediaType.TEXT_HTML_VALUE, MediaType.ALL_VALUE }
    )
    public ResponseEntity<String> saleBuyerBill(
            @PathVariable Long saleId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return html(billService.generateSaleBuyerBillHtml(saleId, lang));
    }

    private ResponseEntity<String> html(String body) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
    }

    @GetMapping(value = "/farmer/{farmerId}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> farmerBillPdf(@PathVariable Long farmerId) {
        byte[] pdf = billService.generateFarmerBillPdf(farmerId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=farmer-bill-" + farmerId + ".pdf")
                .body(pdf);
    }

    @GetMapping(value = "/buyer/{buyerId}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> buyerBillPdf(@PathVariable Long buyerId) {
        byte[] pdf = billService.generateBuyerBillPdf(buyerId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=buyer-bill-" + buyerId + ".pdf")
                .body(pdf);
    }
}
