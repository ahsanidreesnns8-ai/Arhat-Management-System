package com.rehmani.trading.service;

import com.rehmani.trading.dto.*;
import com.rehmani.trading.entity.Dheri;
import com.rehmani.trading.entity.Sale;
import com.rehmani.trading.entity.Stock;
import com.rehmani.trading.repository.DheriRepository;
import com.rehmani.trading.repository.SaleRepository;
import com.rehmani.trading.repository.StockRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final SaleRepository saleRepository;
    private final DheriRepository dheriRepository;
    private final StockRepository stockRepository;

    public SalesReportSummary getSalesReport(LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : LocalDate.now().minusMonths(1);
        LocalDate end = to != null ? to : LocalDate.now();

        List<Sale> sales = saleRepository.findByDateRange(start, end);
        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;

        List<SaleReportLine> lines = sales.stream().map(s -> {
            return SaleReportLine.builder()
                    .saleId(s.getId())
                    .invoiceNumber(s.getInvoiceNumber())
                    .saleDate(s.getSaleDate())
                    .buyerName(s.getBuyer().getName())
                    .totalBags(s.getTotalBags())
                    .totalWeight(s.getTotalWeight())
                    .totalAmount(s.getTotalAmount())
                    .paidAmount(s.getPaidAmount())
                    .build();
        }).toList();

        for (Sale s : sales) {
            totalAmount = totalAmount.add(s.getTotalAmount());
            totalPaid = totalPaid.add(s.getPaidAmount());
        }

        return SalesReportSummary.builder()
                .from(start)
                .to(end)
                .totalSales(sales.size())
                .totalAmount(totalAmount)
                .totalPaid(totalPaid)
                .totalOutstanding(totalAmount.subtract(totalPaid))
                .lines(lines)
                .build();
    }

    public CommissionReportSummary getCommissionReport(LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : LocalDate.now().minusMonths(1);
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDateTime fromDt = start.atStartOfDay();
        LocalDateTime toDt = end.atTime(LocalTime.MAX);

        List<Dheri> dheris = dheriRepository.findByCreatedAtRange(fromDt, toDt);
        BigDecimal totalCommission = BigDecimal.ZERO;
        BigDecimal totalArhat = BigDecimal.ZERO;
        BigDecimal totalSupervisor = BigDecimal.ZERO;
        BigDecimal totalLabor = BigDecimal.ZERO;

        List<CommissionReportLine> lines = dheris.stream().map(d -> {
            return CommissionReportLine.builder()
                    .dheriId(d.getId())
                    .dheriNumber(d.getDheriId())
                    .farmerName(d.getFarmer().getName())
                    .totalPrice(d.getTotalPrice())
                    .commissionAmount(d.getCommissionAmount())
                    .arhatShare(d.getArhatShare())
                    .supervisorShare(d.getSupervisorShare())
                    .laborShare(d.getLaborShare())
                    .build();
        }).toList();

        for (Dheri d : dheris) {
            totalCommission = totalCommission.add(d.getCommissionAmount());
            totalArhat = totalArhat.add(d.getArhatShare());
            totalSupervisor = totalSupervisor.add(d.getSupervisorShare());
            totalLabor = totalLabor.add(d.getLaborShare());
        }

        return CommissionReportSummary.builder()
                .from(start)
                .to(end)
                .totalCommission(totalCommission)
                .totalArhatShare(totalArhat)
                .totalSupervisorShare(totalSupervisor)
                .totalLaborShare(totalLabor)
                .lines(lines)
                .build();
    }

    public StockReportSummary getStockReport() {
        List<Stock> stockList = stockRepository.findAllWithProduct();
        BigDecimal totalQty = BigDecimal.ZERO;
        int lowStockCount = 0;

        List<StockReportLine> lines = stockList.stream().map(s -> {
            return StockReportLine.builder()
                    .productId(s.getProduct().getId())
                    .productCode(s.getProduct().getProductCode())
                    .productName(s.getProduct().getName())
                    .quantity(s.getQuantity())
                    .lowStockAlert(s.getLowStockAlert())
                    .build();
        }).toList();

        for (Stock s : stockList) {
            totalQty = totalQty.add(s.getQuantity());
            if (Boolean.TRUE.equals(s.getLowStockAlert())) {
                lowStockCount++;
            }
        }

        return StockReportSummary.builder()
                .totalQuantity(totalQty)
                .lowStockCount(lowStockCount)
                .lines(lines)
                .build();
    }

    public ProfitReportSummary getProfitReport(LocalDate from, LocalDate to) {
        SalesReportSummary sales = getSalesReport(from, to);
        CommissionReportSummary commission = getCommissionReport(from, to);

        return ProfitReportSummary.builder()
                .from(sales.getFrom())
                .to(sales.getTo())
                .totalSales(sales.getTotalAmount())
                .totalCommission(commission.getTotalCommission())
                .estimatedProfit(commission.getTotalCommission())
                .build();
    }

    public byte[] exportSalesExcel(LocalDate from, LocalDate to) {
        SalesReportSummary report = getSalesReport(from, to);
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Sales");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Invoice");
            header.createCell(1).setCellValue("Date");
            header.createCell(2).setCellValue("Buyer");
            header.createCell(3).setCellValue("Bags");
            header.createCell(4).setCellValue("Weight");
            header.createCell(5).setCellValue("Amount");
            header.createCell(6).setCellValue("Paid");

            int rowNum = 1;
            for (SaleReportLine line : report.getLines()) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(line.getInvoiceNumber());
                row.createCell(1).setCellValue(line.getSaleDate().toString());
                row.createCell(2).setCellValue(line.getBuyerName());
                row.createCell(3).setCellValue(line.getTotalBags());
                row.createCell(4).setCellValue(line.getTotalWeight().doubleValue());
                row.createCell(5).setCellValue(line.getTotalAmount().doubleValue());
                row.createCell(6).setCellValue(line.getPaidAmount().doubleValue());
            }
            for (int i = 0; i < 7; i++) sheet.autoSizeColumn(i);
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to export sales report", e);
        }
    }

    public byte[] exportCommissionExcel(LocalDate from, LocalDate to) {
        CommissionReportSummary report = getCommissionReport(from, to);
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Commission");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Dheri");
            header.createCell(1).setCellValue("Farmer");
            header.createCell(2).setCellValue("Total Price");
            header.createCell(3).setCellValue("Commission");
            header.createCell(4).setCellValue("Arhat");
            header.createCell(5).setCellValue("Supervisor");
            header.createCell(6).setCellValue("Labor");

            int rowNum = 1;
            for (CommissionReportLine line : report.getLines()) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(line.getDheriNumber());
                row.createCell(1).setCellValue(line.getFarmerName());
                row.createCell(2).setCellValue(line.getTotalPrice().doubleValue());
                row.createCell(3).setCellValue(line.getCommissionAmount().doubleValue());
                row.createCell(4).setCellValue(line.getArhatShare().doubleValue());
                row.createCell(5).setCellValue(line.getSupervisorShare().doubleValue());
                row.createCell(6).setCellValue(line.getLaborShare().doubleValue());
            }
            for (int i = 0; i < 7; i++) sheet.autoSizeColumn(i);
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to export commission report", e);
        }
    }

    public byte[] exportStockExcel() {
        StockReportSummary report = getStockReport();
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Stock");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Code");
            header.createCell(1).setCellValue("Product");
            header.createCell(2).setCellValue("Quantity");
            header.createCell(3).setCellValue("Low Stock");

            int rowNum = 1;
            for (StockReportLine line : report.getLines()) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(line.getProductCode());
                row.createCell(1).setCellValue(line.getProductName());
                row.createCell(2).setCellValue(line.getQuantity() != null ? line.getQuantity().doubleValue() : 0);
                row.createCell(3).setCellValue(Boolean.TRUE.equals(line.getLowStockAlert()) ? "YES" : "NO");
            }
            for (int i = 0; i < 4; i++) sheet.autoSizeColumn(i);
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to export stock report", e);
        }
    }

    public byte[] exportProfitExcel(LocalDate from, LocalDate to) {
        ProfitReportSummary report = getProfitReport(from, to);
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Profit");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("From");
            header.createCell(1).setCellValue("To");
            header.createCell(2).setCellValue("Total Sales");
            header.createCell(3).setCellValue("Total Commission");
            header.createCell(4).setCellValue("Estimated Profit");

            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue(report.getFrom() != null ? report.getFrom().toString() : "");
            row.createCell(1).setCellValue(report.getTo() != null ? report.getTo().toString() : "");
            row.createCell(2).setCellValue(report.getTotalSales() != null ? report.getTotalSales().doubleValue() : 0);
            row.createCell(3).setCellValue(report.getTotalCommission() != null ? report.getTotalCommission().doubleValue() : 0);
            row.createCell(4).setCellValue(report.getEstimatedProfit() != null ? report.getEstimatedProfit().doubleValue() : 0);
            for (int i = 0; i < 5; i++) sheet.autoSizeColumn(i);
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to export profit report", e);
        }
    }
}
