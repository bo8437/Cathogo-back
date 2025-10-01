-- Create clients table if it doesn't exist
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(36) PRIMARY KEY,
    order_giver_name VARCHAR(255) NOT NULL,
    order_giver_account VARCHAR(50) NOT NULL,
    order_giver_address TEXT NOT NULL,
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_account VARCHAR(50) NOT NULL,
    beneficiary_address TEXT NOT NULL,
    beneficiary_bank_name VARCHAR(255) NOT NULL,
    beneficiary_bank_swift VARCHAR(20) NOT NULL,
    amount TEXT NOT NULL,
    amount_in_words TEXT NOT NULL,
    transfer_reason TEXT,
    transfer_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Create documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(36) PRIMARY KEY,
    client_id VARCHAR(36) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Create index on documents.client_id if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'documents';
SET @indexname = 'idx_documents_client_id';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(1) FROM information_schema.statistics
        WHERE table_schema = @dbname
        AND table_name = @tablename
        AND index_name = @indexname
    ) > 0,
    'SELECT 1',
    CONCAT('CREATE INDEX ', @indexname, ' ON ', @dbname, '.', @tablename, '(client_id)')
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index on clients.created_at if it doesn't exist
SET @tablename = 'clients';
SET @indexname = 'idx_clients_created_at';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(1) FROM information_schema.statistics
        WHERE table_schema = @dbname
        AND table_name = @tablename
        AND index_name = @indexname
    ) > 0,
    'SELECT 1',
    CONCAT('CREATE INDEX ', @indexname, ' ON ', @dbname, '.', @tablename, '(created_at)')
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
