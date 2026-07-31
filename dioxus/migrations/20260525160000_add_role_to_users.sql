-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- Insert default admin user
-- NOTE: The password is 'admin'. Please change this in production!
INSERT INTO users (full_name, email, password_hash, role, is_verified, preferred_language) 
VALUES ('Admin LingoMind', 'admin@lingomind.com', '$2b$12$OnM/nwU952Jy3CEojVOEcuzw.KDSUYN/DmKRsK38Tw.26S.J7dz.m', 'admin', true, 'English')
ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = '$2b$12$OnM/nwU952Jy3CEojVOEcuzw.KDSUYN/DmKRsK38Tw.26S.J7dz.m';
