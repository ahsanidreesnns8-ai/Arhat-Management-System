package com.rehmani.trading.controller;

import com.rehmani.trading.dto.ApiResponse;
import com.rehmani.trading.dto.BackupData;
import com.rehmani.trading.service.BackupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/backup")
@RequiredArgsConstructor
public class BackupController {

    private final BackupService backupService;

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportZip() {
        byte[] data = backupService.exportZip();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rehmani-backup.zip")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @GetMapping(value = "/export/json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ApiResponse<BackupData> exportJson() {
        return ApiResponse.ok(backupService.exportJson());
    }

    @PostMapping("/restore")
    @PreAuthorize("hasRole('OWNER')")
    public ApiResponse<Void> restore(@RequestBody BackupData data) {
        backupService.restore(data);
        return ApiResponse.ok("Backup restored", null);
    }
}
