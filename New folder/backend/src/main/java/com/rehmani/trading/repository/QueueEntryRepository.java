package com.rehmani.trading.repository;

import com.rehmani.trading.entity.QueueEntry;
import com.rehmani.trading.entity.QueueStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QueueEntryRepository extends JpaRepository<QueueEntry, Long> {
    List<QueueEntry> findByStatusOrderByPositionAsc(QueueStatus status);
    Optional<QueueEntry> findByDheriId(Long dheriId);
    Optional<QueueEntry> findTopByOrderByQueueNumberDesc();
    Optional<QueueEntry> findTopByOrderByPositionDesc();
}
