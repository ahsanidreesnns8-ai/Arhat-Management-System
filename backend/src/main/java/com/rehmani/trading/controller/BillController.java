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

    @GetMapping(value = "/farmer/{farmerId}", produces = MediaType.TEXT_HTML_VALUE)
    public String farmerBill(
            @PathVariable Long farmerId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return billService.generateFarmerBillHtml(farmerId, lang);
    }

    @GetMapping(value = "/buyer/{buyerId}", produces = MediaType.TEXT_HTML_VALUE)
    public String buyerBill(
            @PathVariable Long buyerId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return billService.generateBuyerBillHtml(buyerId, lang);
    }

    @GetMapping(value = "/sale/{saleId}/farmer", produces = MediaType.TEXT_HTML_VALUE)
    public String saleFarmerBill(
            @PathVariable Long saleId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return billService.generateSaleFarmerBillHtml(saleId, lang);
    }

    @GetMapping(value = "/sale/{saleId}/buyer", produces = MediaType.TEXT_HTML_VALUE)
    public String saleBuyerBill(
            @PathVariable Long saleId,
            @RequestParam(defaultValue = "en") String lang
    ) {
        return billService.generateSaleBuyerBillHtml(saleId, lang);
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
