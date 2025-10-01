-- Create super admin with properly hashed password
-- Password: Admin@AFG2023!
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
    '$2b$10$I2V.B926t3sR3Cmc9qV1A.amI/QskM/hlG5osQ.bGvE9koAXty/Vu',
    'System Super Admin',
    'super_admin',
    1,
    NOW(),
    NOW()
);
