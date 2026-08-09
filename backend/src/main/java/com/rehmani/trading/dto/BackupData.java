package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class BackupData {
    private Map<String, Object> settings;
    private List<Map<String, Object>> farmers;
    private List<Map<String, Object>> buyers;
    private List<Map<String, Object>> products;
    private List<Map<String, Object>> stock;
    private List<Map<String, Object>> sales;
    private List<Map<String, Object>> dheris;
}
