package com.rehmani.trading.service;

import com.rehmani.trading.dto.QueueEntryResponse;
import com.rehmani.trading.entity.Dheri;
import com.rehmani.trading.entity.QueueEntry;
import com.rehmani.trading.entity.QueueStatus;
import com.rehmani.trading.entity.SellingStatus;
import com.rehmani.trading.repository.DheriRepository;
import com.rehmani.trading.repository.QueueEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class QueueService {

    private final QueueEntryRepository queueEntryRepository;
    private final DheriRepository dheriRepository;

    public List<QueueEntryResponse> getPending() {
        return queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.PENDING)
                .stream().map(this::toResponse).toList();
    }

    public List<QueueEntryResponse> getActive() {
        return queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.ACTIVE)
                .stream().map(this::toResponse).toList();
    }

    public List<QueueEntryResponse> getCompleted() {
        return queueEntryRepository.findByStatusOrderByPositionAsc(QueueStatus.COMPLETED)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public QueueEntryResponse addToQueue(Long dheriId) {
        Dheri dheri = dheriRepository.findByIdAndDeletedFalse(dheriId)
                .orElseThrow(() -> new RuntimeException("Dheri not found"));

        if (queueEntryRepository.findByDheriId(dheriId).isPresent()) {
            throw new RuntimeException("Dheri already in queue");
        }

        int nextQueueNumber = queueEntryRepository.findTopByOrderByQueueNumberDesc()
                .map(q -> q.getQueueNumber() + 1).orElse(1);
        int nextPosition = queueEntryRepository.findTopByOrderByPositionDesc()
                .map(q -> q.getPosition() + 1).orElse(1);

        QueueEntry entry = QueueEntry.builder()
                .queueNumber(nextQueueNumber)
                .dheri(dheri)
                .status(QueueStatus.PENDING)
                .position(nextPosition)
                .build();

        dheri.setQueueNumber(nextQueueNumber);
        dheri.setSellingStatus(SellingStatus.IN_QUEUE);
        dheriRepository.save(dheri);

        return toResponse(queueEntryRepository.save(entry));
    }

    @Transactional
    public QueueEntryResponse activate(Long id) {
        QueueEntry entry = queueEntryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Queue entry not found"));
        entry.setStatus(QueueStatus.ACTIVE);
        entry.setStartedAt(LocalDateTime.now());
        entry.getDheri().setSellingStatus(SellingStatus.SELLING);
        return toResponse(queueEntryRepository.save(entry));
    }

    @Transactional
    public QueueEntryResponse complete(Long id) {
        QueueEntry entry = queueEntryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Queue entry not found"));
        entry.setStatus(QueueStatus.COMPLETED);
        entry.setCompletedAt(LocalDateTime.now());
        entry.getDheri().setSellingStatus(SellingStatus.SOLD);
        return toResponse(queueEntryRepository.save(entry));
    }

    @Transactional
    public QueueEntryResponse cancel(Long id) {
        QueueEntry entry = queueEntryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Queue entry not found"));
        entry.setStatus(QueueStatus.CANCELLED);
        entry.getDheri().setSellingStatus(SellingStatus.CANCELLED);
        return toResponse(queueEntryRepository.save(entry));
    }

    private QueueEntryResponse toResponse(QueueEntry entry) {
        Dheri dheri = entry.getDheri();
        return QueueEntryResponse.builder()
                .id(entry.getId())
                .queueNumber(entry.getQueueNumber())
                .dheriId(dheri.getId())
                .dheriCode(dheri.getDheriId())
                .farmerName(dheri.getFarmer().getName())
                .productName(dheri.getProduct().getName())
                .status(entry.getStatus().name())
                .position(entry.getPosition())
                .numberOfBags(dheri.getNumberOfBags())
                .build();
    }
}
