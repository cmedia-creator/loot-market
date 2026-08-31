INSERT OR IGNORE INTO stages (id, slug, name, description, image_key, sort_order, is_active)
VALUES (
  'stage-02',
  'midnight-impulse-graveyard',
  '午前2時の衝動買い墓場',
  '深夜テンションでカートに放り込まれた、妙にレアで妙に欲しくなる品々が漂着するネオン廃モール。ここではやり直しが効かない。',
  'builtin/stage-02/background.svg',
  2,
  1
);

INSERT OR IGNORE INTO enemies (id, stage_id, name, image_key, hp, attack_min, attack_max, spawn_weight, sort_order, is_active) VALUES
('enemy-cart-ghost', 'stage-02', 'カートノコシ', 'builtin/stage-02/cart-ghost.svg', 10, 1, 3, 3, 1, 1),
('enemy-coupon-bat', 'stage-02', 'クーポンコウモリ', 'builtin/stage-02/coupon-bat.svg', 9, 1, 3, 3, 2, 1),
('enemy-shipping-slime', 'stage-02', '送料無料スライム', 'builtin/stage-02/shipping-slime.svg', 12, 2, 3, 2, 3, 1),
('enemy-review-zombie', 'stage-02', '★1レビュー亡者', 'builtin/stage-02/review-zombie.svg', 13, 2, 4, 2, 4, 1),
('enemy-checkout-golem', 'stage-02', '決済ゴーレム', 'builtin/stage-02/checkout-golem.svg', 15, 2, 4, 1, 5, 1);

INSERT OR IGNORE INTO bosses (id, stage_id, name, image_key, hp, attack_min, attack_max, is_rare, encounter_rate, min_loot_rarity, sort_order, is_active) VALUES
('boss-nemurenine', 'stage-02', '深夜通販王 ネムレナイン', 'builtin/stage-02/nemurenine.svg', 34, 3, 5, 0, 0.94, 3, 1, 1),
('boss-deadline-reaper', 'stage-02', '返品期限の死神 シメキリ', 'builtin/stage-02/deadline-reaper.svg', 40, 3, 6, 1, 0.06, 4, 2, 1);

INSERT OR IGNORE INTO stage_conditions (id, stage_id, type, label, target_value, sort_order, is_active) VALUES
('cond-midnight-kill-4', 'stage-02', 'kill', '買う理由を考える前にザコ敵を4体撃破せよ', 4, 1, 1),
('cond-midnight-kill-6', 'stage-02', 'kill', 'カートを守り抜きザコ敵を6体撃破せよ', 6, 2, 1),
('cond-midnight-kill-8', 'stage-02', 'kill', '午前2時の正気を証明しザコ敵を8体撃破せよ', 8, 3, 1);

INSERT OR IGNORE INTO stage_game_rules (stage_id, disabled_turn_dice, disabled_special_dice, disabled_combo_skills)
VALUES ('stage-02', '[]', '["revive"]', '[]');
