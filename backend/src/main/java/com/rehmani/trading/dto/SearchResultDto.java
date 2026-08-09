package com.rehmani.trading.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SearchResultDto {
    private String id;
    private String type;
    private String title;
    private String subtitle;
    private String link;
}
