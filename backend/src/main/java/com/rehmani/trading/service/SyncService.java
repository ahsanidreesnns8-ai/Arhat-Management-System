package com.rehmani.trading.service;

import com.rehmani.trading.dto.SyncPulseResponse;
import com.rehmani.trading.entity.SyncState;
import com.rehmani.trading.repository.SyncStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class SyncService {

    private final SyncStateRepository syncStateRepository;

    @Transactional
    public void bump() {
        ensureRow();
        syncStateRepository.bumpRevision();
    }

    @Transactional(readOnly = true)
    public SyncPulseResponse pulse() {
        SyncState state = ensureRow();
        return SyncPulseResponse.builder()
                .revision(state.getRevision() != null ? state.getRevision() : 1L)
                .serverTime(Instant.now().toString())
                .updatedAt(state.getUpdatedAt() != null ? state.getUpdatedAt().toString() : null)
                .build();
    }

    private SyncState ensureRow() {
        return syncStateRepository.findById(1L).orElseGet(() ->
                syncStateRepository.save(SyncState.builder().id(1L).revision(1L).build()));
    }
}
