-- Drop legacy 'token' column from refresh_tokens if it exists (we use token_hash instead)
SET @dbname = DATABASE();
SET @tablename = 'refresh_tokens';
SET @columnname = 'token';

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_schema = @dbname
      AND table_name = @tablename
      AND column_name = @columnname
  ) = 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @dbname, '.', @tablename, ' DROP COLUMN ', @columnname)
));

PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
