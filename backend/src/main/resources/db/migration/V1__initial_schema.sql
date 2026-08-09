-- Rehmani Trading Company ERP - Initial Schema

CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('OWNER', 'ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER') NOT NULL DEFAULT 'OPERATOR',
    theme_preference ENUM('LIGHT', 'DARK', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE business_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL DEFAULT 'Rehmani Trading Company',
    company_logo_url VARCHAR(500),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    default_commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    supervisor_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    labor_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    arhat_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    low_stock_threshold DECIMAL(12,2) NOT NULL DEFAULT 100.00,
    backup_reminder_days INT NOT NULL DEFAULT 7,
    payment_reminder_days INT NOT NULL DEFAULT 3,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'BAG',
    default_bag_weight DECIMAL(10,2) NOT NULL DEFAULT 40.00,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_products_name (name),
    INDEX idx_products_code (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE farmers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farmer_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    cnic VARCHAR(20),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    outstanding_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_farmers_farmer_id (farmer_id),
    INDEX idx_farmers_cnic (cnic),
    INDEX idx_farmers_phone (phone),
    INDEX idx_farmers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE buyers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    buyer_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    cnic VARCHAR(20),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    outstanding_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_buyers_buyer_id (buyer_id),
    INDEX idx_buyers_cnic (cnic),
    INDEX idx_buyers_phone (phone),
    INDEX idx_buyers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trucks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    truck_id VARCHAR(20) NOT NULL UNIQUE,
    registration_number VARCHAR(50) NOT NULL,
    driver_name VARCHAR(255),
    driver_phone VARCHAR(20),
    farmer_id BIGINT NOT NULL,
    capacity DECIMAL(10,2),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_trucks_farmer FOREIGN KEY (farmer_id) REFERENCES farmers(id),
    INDEX idx_trucks_truck_id (truck_id),
    INDEX idx_trucks_farmer (farmer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dheris (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dheri_id VARCHAR(20) NOT NULL UNIQUE,
    farmer_id BIGINT NOT NULL,
    truck_id BIGINT,
    product_id BIGINT NOT NULL,
    queue_number INT,
    number_of_bags INT NOT NULL DEFAULT 0,
    weight_per_bag DECIMAL(10,2) NOT NULL DEFAULT 40.00,
    partial_bag_weight DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    market_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    total_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    commission_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    farmer_receivable DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    supervisor_share DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    labor_share DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    arhat_share DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    selling_status ENUM('PENDING', 'IN_QUEUE', 'SELLING', 'SOLD', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dheris_farmer FOREIGN KEY (farmer_id) REFERENCES farmers(id),
    CONSTRAINT fk_dheris_truck FOREIGN KEY (truck_id) REFERENCES trucks(id),
    CONSTRAINT fk_dheris_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_dheris_dheri_id (dheri_id),
    INDEX idx_dheris_queue (queue_number),
    INDEX idx_dheris_status (selling_status),
    INDEX idx_dheris_farmer (farmer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE,
    quantity DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    low_stock_alert BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_stock_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stock_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    transaction_type ENUM('INCOMING', 'OUTGOING', 'TRANSFER', 'ADJUSTMENT', 'SALE') NOT NULL,
    quantity DECIMAL(15,2) NOT NULL,
    previous_quantity DECIMAL(15,2) NOT NULL,
    new_quantity DECIMAL(15,2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_tx_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_stock_tx_user FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_stock_tx_product (product_id),
    INDEX idx_stock_tx_type (transaction_type),
    INDEX idx_stock_tx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE queue_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    queue_number INT NOT NULL,
    dheri_id BIGINT NOT NULL UNIQUE,
    status ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    position INT NOT NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_queue_dheri FOREIGN KEY (dheri_id) REFERENCES dheris(id),
    INDEX idx_queue_number (queue_number),
    INDEX idx_queue_status (status),
    INDEX idx_queue_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    buyer_id BIGINT NOT NULL,
    sale_date DATE NOT NULL,
    total_bags INT NOT NULL DEFAULT 0,
    total_weight DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('PENDING', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id),
    CONSTRAINT fk_sales_user FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_sales_invoice (invoice_number),
    INDEX idx_sales_date (sale_date),
    INDEX idx_sales_buyer (buyer_id),
    INDEX idx_sales_status (payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sale_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    source_type ENUM('FARMER', 'BUSINESS_STOCK') NOT NULL,
    farmer_id BIGINT,
    dheri_id BIGINT,
    number_of_bags INT NOT NULL DEFAULT 0,
    weight_per_bag DECIMAL(10,2) NOT NULL DEFAULT 40.00,
    partial_bag_weight DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_sale_items_farmer FOREIGN KEY (farmer_id) REFERENCES farmers(id),
    CONSTRAINT fk_sale_items_dheri FOREIGN KEY (dheri_id) REFERENCES dheris(id),
    INDEX idx_sale_items_sale (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_type ENUM('FARMER', 'BUYER') NOT NULL,
    farmer_id BIGINT,
    buyer_id BIGINT,
    sale_id BIGINT,
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER') NOT NULL DEFAULT 'CASH',
    payment_date DATE NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_farmer FOREIGN KEY (farmer_id) REFERENCES farmers(id),
    CONSTRAINT fk_payments_buyer FOREIGN KEY (buyer_id) REFERENCES buyers(id),
    CONSTRAINT fk_payments_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
    CONSTRAINT fk_payments_user FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_payments_farmer (farmer_id),
    INDEX idx_payments_buyer (buyer_id),
    INDEX idx_payments_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id BIGINT,
    old_value JSON,
    new_value JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_date (created_at),
    INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default data
INSERT INTO business_settings (company_name, address, phone, email) VALUES
('Rehmani Trading Company', 'Main Market, Grain Trading Hub', '+92-300-0000000', 'info@rehmanitrading.com');

INSERT INTO products (product_code, name, default_bag_weight) VALUES
('WHT-001', 'Wheat', 40.00),
('RCE-001', 'Rice', 40.00),
('MAZ-001', 'Maize', 40.00),
('BAR-001', 'Barley', 40.00);

INSERT INTO stock (product_id, quantity) SELECT id, 0 FROM products;

INSERT INTO users (username, email, password, full_name, role) VALUES
('owner', 'owner@rehmanitrading.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'System Owner', 'OWNER');
-- Default password: admin123
