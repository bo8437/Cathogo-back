-- Ensure refresh_tokens has required columns; add token_hash if missing
SET @dbname = DATABASE();
SET @tablename = 'refresh_tokens';

-- Add token_hash column if it doesn't exist
SET @columnname = 'token_hash';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = @dbname
          AND table_name = @tablename
          AND column_name = @columnname
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @dbname, '.', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) NOT NULL AFTER user_id')
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
