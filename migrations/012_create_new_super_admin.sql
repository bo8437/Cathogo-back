-- Create new super admin user
-- Password: Admin@AFG2023! (bcrypt hashed)
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
    'superadmin@afgbank.cm',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- hashed 'Admin@AFG2023!'
    'System Super Admin',
    'super_admin',
    1,
    NOW(),
    NOW()
);
