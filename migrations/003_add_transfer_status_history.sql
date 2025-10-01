-- Create transfer_status_history table to track status changes
CREATE TABLE IF NOT EXISTS transfer_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transfer_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_transfer_id (transfer_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;
