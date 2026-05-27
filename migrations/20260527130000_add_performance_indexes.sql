-- Add performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_user_inventory_email ON user_inventory(email);
CREATE INDEX IF NOT EXISTS idx_user_engagement_stats_email ON user_engagement_stats(email);
CREATE INDEX IF NOT EXISTS idx_shop_items_effect ON shop_items(effect_type);
