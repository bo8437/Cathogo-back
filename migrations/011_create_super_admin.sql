-- Create super admin user
-- Password will be hashed by the application
INSERT INTO users (
    id, 
    email, 
    password_hash, 
    name, 
    role, 
    is_active, 
    created_at, 
    updated_at
) VALUES (
    UUID(),
    'admin@afgbank.cm',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password is 'ChangeMe!123'
    'Super Admin',
    'super_admin',
    1,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE 
    email = VALUES(email),
    name = VALUES(name),
    role = VALUES(role),
    is_active = VALUES(is_active),
    updated_at = NOW();
