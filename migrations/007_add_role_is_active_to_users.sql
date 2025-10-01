-- Add missing 'role' and 'is_active' columns to users table if they do not exist
SET @dbname = DATABASE();
SET @tablename = 'users';

-- Add role column
SET @columnname = 'role';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = @dbname
          AND table_name = @tablename
          AND column_name = @columnname
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @dbname, '.', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(50) NOT NULL DEFAULT "AGENCES" AFTER name')
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_active column
SET @columnname = 'is_active';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = @dbname
          AND table_name = @tablename
          AND column_name = @columnname
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @dbname, '.', @tablename, ' ADD COLUMN ', @columnname, ' TINYINT(1) NOT NULL DEFAULT 1 AFTER role')
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
