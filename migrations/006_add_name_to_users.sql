-- Add missing 'name' column to users table if it does not exist (handles legacy tables)
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'name';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = @dbname
          AND table_name = @tablename
          AND column_name = @columnname
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @dbname, '.', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) NULL AFTER email')
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
