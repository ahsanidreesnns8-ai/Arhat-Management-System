package com.rehmani.trading.service;

import com.rehmani.trading.dto.SearchResultDto;
import com.rehmani.trading.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final FarmerRepository farmerRepository;
    private final BuyerRepository buyerRepository;
    private final TruckRepository truckRepository;
    private final DheriRepository dheriRepository;
    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;

    public List<SearchResultDto> search(String query) {
        if (query == null || query.trim().length() < 2) {
            return List.of();
        }

        String q = query.trim();
        List<SearchResultDto> results = new ArrayList<>();

        farmerRepository.search(q).stream().limit(5).forEach(f ->
                results.add(SearchResultDto.builder()
                        .id(f.getFarmerId())
                        .type("FARMER")
                        .title(f.getName())
                        .subtitle("Farmer ID: " + f.getFarmerId())
                        .link("/farmers/" + f.getId())
                        .build()));

        buyerRepository.search(q).stream().limit(5).forEach(b ->
                results.add(SearchResultDto.builder()
                        .id(b.getBuyerId())
                        .type("BUYER")
                        .title(b.getName())
                        .subtitle("Buyer ID: " + b.getBuyerId())
                        .link("/buyers/" + b.getId())
                        .build()));

        truckRepository.search(q).stream().limit(5).forEach(t ->
                results.add(SearchResultDto.builder()
                        .id(t.getTruckId())
                        .type("TRUCK")
                        .title(t.getRegistrationNumber())
                        .subtitle("Truck ID: " + t.getTruckId())
                        .link("/trucks/" + t.getId())
                        .build()));

        dheriRepository.search(q).stream().limit(5).forEach(d ->
                results.add(SearchResultDto.builder()
                        .id(d.getDheriId())
                        .type("DHERI")
                        .title("Dheri " + d.getDheriId())
                        .subtitle("Queue: " + (d.getQueueNumber() != null ? d.getQueueNumber() : "N/A"))
                        .link("/dheris/" + d.getId())
                        .build()));

        saleRepository.search(q).stream().limit(5).forEach(s ->
                results.add(SearchResultDto.builder()
                        .id(s.getInvoiceNumber())
                        .type("INVOICE")
                        .title(s.getInvoiceNumber())
                        .subtitle("Buyer: " + s.getBuyer().getName())
                        .link("/sales/" + s.getId())
                        .build()));

        productRepository.search(q).stream().limit(5).forEach(p ->
                results.add(SearchResultDto.builder()
                        .id(p.getProductCode())
                        .type("PRODUCT")
                        .title(p.getName())
                        .subtitle("Code: " + p.getProductCode())
                        .link("/stock?product=" + p.getId())
                        .build()));

        return results;
    }
}
