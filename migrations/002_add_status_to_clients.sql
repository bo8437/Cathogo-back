-- Add status column to clients table with default value 'En Attente' if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'clients';
SET @columnname = 'status';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = @dbname
        AND table_name = @tablename
        AND column_name = @columnname
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @dbname, '.', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(50) NOT NULL DEFAULT \'En Attente\' AFTER transfer_type')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
