ALTER TABLE user_engagement_stats ADD COLUMN active_title TEXT;
ALTER TABLE user_engagement_stats ADD COLUMN active_name_color TEXT;

INSERT INTO shop_items (name, description, cost, effect_type, icon_name) VALUES 
('Gelar: Polyglot', 'Tampilkan gelar Polyglot di samping namamu.', 500, 'title_polyglot', '🎓'),
('Gelar: Sultan', 'Gelar eksklusif untuk para sultan LingoMind.', 1000, 'title_sultan', '👑'),
('Gelar: Legend', 'Jadilah legenda di papan peringkat.', 2000, 'title_legend', '🌟'),
('Warna Nama: Gold', 'Warna nama emas berkilau.', 800, 'name_color_gold', '✨'),
('Warna Nama: Crimson', 'Warna nama merah menyala.', 800, 'name_color_crimson', '🔥'),
('Warna Nama: Neon Blue', 'Warna nama biru neon.', 800, 'name_color_neon_blue', '⚡');
