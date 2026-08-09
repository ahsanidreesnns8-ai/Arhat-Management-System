-- Link payments to dheris for day-wise settlement records
ALTER TABLE payments
    ADD COLUMN dheri_id BIGINT NULL AFTER sale_id,
    ADD CONSTRAINT fk_payments_dheri FOREIGN KEY (dheri_id) REFERENCES dheris(id),
    ADD INDEX idx_payments_dheri (dheri_id);

-- Track whether farmer payable from this dheri was already posted to farmer.outstanding_balance
ALTER TABLE dheris
    ADD COLUMN payable_posted BOOLEAN NOT NULL DEFAULT FALSE AFTER selling_status;
