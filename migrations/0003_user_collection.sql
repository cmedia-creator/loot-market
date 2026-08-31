PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_item_states (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  discovered_at TEXT,
  wanted INTEGER NOT NULL DEFAULT 0 CHECK (wanted IN (0,1)),
  owned INTEGER NOT NULL DEFAULT 0 CHECK (owned IN (0,1)),
  saved INTEGER NOT NULL DEFAULT 0 CHECK (saved IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_item_states_user_updated
  ON user_item_states(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_item_states_wanted
  ON user_item_states(user_id, wanted, updated_at DESC);
