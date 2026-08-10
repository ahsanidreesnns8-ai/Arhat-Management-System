package com.rehmani.trading.repository;

import com.rehmani.trading.entity.SyncState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface SyncStateRepository extends JpaRepository<SyncState, Long> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE SyncState s SET s.revision = s.revision + 1 WHERE s.id = 1")
    int bumpRevision();
}
