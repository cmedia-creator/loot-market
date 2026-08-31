PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stage_game_rules (
  stage_id TEXT PRIMARY KEY REFERENCES stages(id) ON DELETE CASCADE,
  disabled_turn_dice TEXT NOT NULL DEFAULT '[]',
  disabled_special_dice TEXT NOT NULL DEFAULT '[]',
  disabled_combo_skills TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO stage_game_rules (stage_id)
SELECT id FROM stages;
