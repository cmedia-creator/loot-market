PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enemies (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_key TEXT,
  hp INTEGER NOT NULL CHECK (hp > 0),
  attack_min INTEGER NOT NULL CHECK (attack_min >= 0),
  attack_max INTEGER NOT NULL CHECK (attack_max >= attack_min),
  spawn_weight INTEGER NOT NULL DEFAULT 1 CHECK (spawn_weight > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bosses (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_key TEXT,
  hp INTEGER NOT NULL CHECK (hp > 0),
  attack_min INTEGER NOT NULL CHECK (attack_min >= 0),
  attack_max INTEGER NOT NULL CHECK (attack_max >= attack_min),
  is_rare INTEGER NOT NULL DEFAULT 0 CHECK (is_rare IN (0,1)),
  encounter_rate REAL NOT NULL DEFAULT 1 CHECK (encounter_rate >= 0 AND encounter_rate <= 1),
  min_loot_rarity INTEGER NOT NULL DEFAULT 3 CHECK (min_loot_rarity BETWEEN 1 AND 5),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL CHECK (provider IN ('rakuten','mercari','other')),
  affiliate_url TEXT NOT NULL DEFAULT '',
  affiliate_source_html TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  price_yen INTEGER CHECK (price_yen IS NULL OR price_yen >= 0),
  rarity INTEGER NOT NULL CHECK (rarity BETWEEN 1 AND 5),
  weirdness INTEGER NOT NULL CHECK (weirdness BETWEEN 1 AND 5),
  usefulness INTEGER NOT NULL CHECK (usefulness BETWEEN 1 AND 5),
  gift_power INTEGER NOT NULL CHECK (gift_power BETWEEN 1 AND 5),
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stage_conditions (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weird','rare','gift','kill','uncommon','potion','legendary','custom')),
  label TEXT NOT NULL,
  target_value INTEGER NOT NULL CHECK (target_value > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enemies_stage ON enemies(stage_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_bosses_stage ON bosses(stage_id, is_active, is_rare, sort_order);
CREATE INDEX IF NOT EXISTS idx_items_stage ON items(stage_id, is_active);
CREATE INDEX IF NOT EXISTS idx_items_provider ON items(provider, is_active);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity, is_active);
CREATE INDEX IF NOT EXISTS idx_conditions_stage ON stage_conditions(stage_id, is_active, sort_order);

INSERT OR IGNORE INTO stages (id, slug, name, description, sort_order, is_active)
VALUES ('stage-01', 'forbidden-daily-goods', '禁断の生活雑貨庫', '日用品、便利グッズ、企画会議の正気を疑う品々が眠る。', 1, 1);

INSERT OR IGNORE INTO enemies (id, stage_id, name, hp, attack_min, attack_max, spawn_weight, sort_order) VALUES
('enemy-storage-mimic', 'stage-01', '収納ミミック', 8, 1, 2, 1, 1),
('enemy-rampage-mop', 'stage-01', '暴走モップ', 9, 1, 3, 1, 2),
('enemy-alarm-counterattack', 'stage-01', '逆襲の目覚まし', 10, 1, 3, 1, 3),
('enemy-infinite-tissue', 'stage-01', '無限ティッシュ', 11, 2, 3, 1, 4),
('enemy-appliance-golem', 'stage-01', '家電ゴーレム', 12, 2, 3, 1, 5);

INSERT OR IGNORE INTO bosses (id, stage_id, name, hp, attack_min, attack_max, is_rare, encounter_rate, min_loot_rarity, sort_order) VALUES
('boss-deadstock-king', 'stage-01', '在庫王 ザ・デッドストック', 28, 2, 4, 0, 0.95, 3, 1),
('boss-no-return-god', 'stage-01', '返品不可神 カエセナイ', 34, 3, 5, 1, 0.05, 4, 2);

INSERT OR IGNORE INTO stage_conditions (id, stage_id, type, label, target_value, sort_order) VALUES
('cond-weird-5', 'stage-01', 'weird', '「意味不明 ★★★★★」を2種類発見せよ', 2, 1),
('cond-rare', 'stage-01', 'rare', 'RARE以上の商品を3種類発見せよ', 3, 2),
('cond-gift-5', 'stage-01', 'gift', '「プレゼント力 ★★★★★」を2種類発見せよ', 2, 3),
('cond-kill', 'stage-01', 'kill', 'ザコ敵を5体撃破せよ', 5, 4),
('cond-uncommon', 'stage-01', 'uncommon', 'UNCOMMON以上の商品を4種類発見せよ', 4, 5);
