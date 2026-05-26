-- 20260526090000_create_virtual_pets.sql
CREATE TABLE IF NOT EXISTS user_pets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL REFERENCES users(email),
    pet_type VARCHAR(50) NOT NULL, -- dragon, owl, fenrir
    stage INTEGER DEFAULT 1, -- 1=Egg, 2=Baby, 3=Teen, 4=Adult
    exp INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_pets_email ON user_pets(email);

-- Insert telur baru ke dalam toko
INSERT INTO shop_items (name, description, cost, effect_type, icon_name) VALUES
('Telur Naga Api', 'Telur panas yang menyimpan kekuatan naga di dalamnya. Beli untuk ditetaskan!', 250, 'egg_dragon', '🥚'),
('Telur Burung Malam', 'Telur berbintik biru yang misterius. Beli untuk ditetaskan!', 250, 'egg_owl', '🥚'),
('Telur Serigala Es', 'Telur sedingin es. Dipercaya berisi serigala legendaris. Beli untuk ditetaskan!', 250, 'egg_fenrir', '🥚');
