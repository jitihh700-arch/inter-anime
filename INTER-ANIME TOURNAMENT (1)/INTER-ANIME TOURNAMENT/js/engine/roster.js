// INTER-ANIME TOURNAMENT — fighter roster (exactly 17 slots).
// Slots 1–16 are the existing fighters from the world's character cards.
// Slot 17 is reserved for the NEW CHALLENGER and is intentionally not playable.

const P = (slug) => `assets/cards/fighter-card-art-${slug}-select-grid-300x400.webp`;

// stats: speed (m/s), light/heavy damage, light/heavy reach (m), weight (knockback resistance 0..1)
// special: { name, desc, type, cooldown (s), ...type params }
export const ROSTER = [
  {
    slot: 1, id: 'goku', name: 'Goku', series: 'Dragon Ball', portrait: P('goku'),
    style: 'Balanced energy-and-martial-arts fighter',
    aura: 0x5fc8ff,
    stats: { speed: 7.5, light: 46, heavy: 92, lightRange: 1.8, heavyRange: 2.15, weight: 0.3 },
    special: { name: 'Kamehameha', desc: 'Charges and fires a long blue energy beam straight ahead.', type: 'beam', cooldown: 8, damage: 190, length: 20, width: 1.0, charge: 0.55, duration: 0.9, color: 0x6fd6ff },
    model: { skin: 0xf2c79e, hair: 'goku', hairColor: 0x15151c, top: 0xf07a1c, under: 0x2347b8, pants: 0xf07a1c, belt: 0x2347b8, boots: 0x2347b8, gloves: null }
  },
  {
    slot: 2, id: 'vegeta', name: 'Vegeta', series: 'Dragon Ball', portrait: P('vegeta'),
    style: 'Explosive heavy attacks and energy blasts',
    aura: 0x6a8cff,
    stats: { speed: 7.2, light: 43, heavy: 100, lightRange: 1.7, heavyRange: 2.2, weight: 0.35 },
    special: { name: 'Big Bang Blast', desc: 'Hurls a heavy energy sphere that explodes on impact.', type: 'projectile', cooldown: 8, damage: 175, speed: 15, radius: 0.85, count: 1, explode: 3.0, charge: 0.45, color: 0x9fb6ff },
    model: { skin: 0xf0c39a, hair: 'vegeta', hairColor: 0x15151c, top: 0x1f3fb0, under: 0x1f3fb0, pants: 0x1f3fb0, belt: 0x1f3fb0, boots: 0xf2f2f2, gloves: 0xf2f2f2, armor: 0xf4f4ee }
  },
  {
    slot: 3, id: 'saitama', name: 'Saitama', series: 'One Punch Man', portrait: P('saitama'),
    style: 'Extremely powerful punches',
    aura: 0xffe066,
    stats: { speed: 7.5, light: 58, heavy: 120, lightRange: 1.85, heavyRange: 2.2, weight: 0.5 },
    special: { name: 'Serious Punch', desc: 'One devastating punch. Enormous damage, very long cooldown.', type: 'punch', cooldown: 14, damage: 270, range: 3.4, arc: 70, charge: 0.7, knock: 18, color: 0xfff2a0 },
    model: { skin: 0xf3cfa8, hair: 'bald', hairColor: 0xf3cfa8, top: 0xf2cf2a, under: 0xf2cf2a, pants: 0xf2cf2a, belt: 0x222222, boots: 0xc0262b, gloves: 0xc0262b, cape: 0xf6f6f6 }
  },
  {
    slot: 4, id: 'beerus', name: 'Beerus', series: 'Dragon Ball', portrait: P('beerus'),
    style: 'Powerful close-range attacks',
    aura: 0xb066ff,
    stats: { speed: 7.3, light: 50, heavy: 108, lightRange: 1.8, heavyRange: 2.2, weight: 0.45 },
    special: { name: 'Hakai Burst', desc: 'Releases destruction energy in a wide sphere around himself.', type: 'aoe', cooldown: 9, damage: 200, radius: 3.6, charge: 0.5, knock: 13, color: 0xb066ff },
    model: { skin: 0x8a6fc0, hair: 'beerus', hairColor: 0x8a6fc0, top: 0x111111, under: 0xd9b23a, pants: 0x2e9bd6, belt: 0xd03a3a, boots: 0xd9b23a, gloves: null, tail: 0x8a6fc0 }
  },
  {
    slot: 5, id: 'frieza', name: 'Frieza', series: 'Dragon Ball', portrait: P('frieza'),
    style: 'Ranged zoning with precise projectiles',
    aura: 0xd96bff,
    stats: { speed: 7.5, light: 41, heavy: 86, lightRange: 1.75, heavyRange: 2.35, weight: 0.3 },
    special: { name: 'Death Beam Volley', desc: 'Fires a rapid volley of five precise energy bolts.', type: 'projectile', cooldown: 7, damage: 38, speed: 30, radius: 0.32, count: 5, interval: 0.11, explode: 0, charge: 0.3, color: 0xff6bdc },
    model: { skin: 0xf3f0f6, hair: 'frieza', hairColor: 0x7b3fb0, top: 0xf3f0f6, under: 0xf3f0f6, pants: 0xf3f0f6, belt: 0xf3f0f6, boots: 0xf3f0f6, gloves: null, tail: 0xf3f0f6, accent: 0x7b3fb0 }
  },
  {
    slot: 6, id: 'naruto', name: 'Naruto Uzumaki', series: 'Naruto', portrait: P('naruto-uzumaki'),
    style: 'Shadow-clone-style attacks',
    aura: 0xffa63d,
    stats: { speed: 7.7, light: 42, heavy: 88, lightRange: 1.7, heavyRange: 2.05, weight: 0.25 },
    special: { name: 'Shadow Clone Rasengan', desc: 'Two shadow clones rush in, then Naruto drives a Rasengan-style strike.', type: 'clones', cooldown: 9, damage: 120, cloneDamage: 35, clones: 2, dashSpeed: 17, range: 1.9, charge: 0.35, color: 0x7fd8ff },
    model: { skin: 0xf3c9a0, hair: 'naruto', hairColor: 0xffd23a, top: 0xf27a1a, under: 0x1b1b24, pants: 0xf27a1a, belt: 0x1b1b24, boots: 0x1b1b24, gloves: null, headband: 0x2a3550 }
  },
  {
    slot: 7, id: 'sasuke', name: 'Sasuke Uchiha', series: 'Naruto', portrait: P('sasuke-uchiha'),
    style: 'Lightning attacks and sword combos',
    aura: 0x8ab8ff,
    stats: { speed: 7.5, light: 42, heavy: 86, lightRange: 2.0, heavyRange: 2.35, weight: 0.25 },
    special: { name: 'Chidori Rush', desc: 'Charges lightning and dashes straight through the opponent.', type: 'dash', cooldown: 8, damage: 175, dashSpeed: 22, dashTime: 0.42, range: 1.6, charge: 0.4, knock: 11, color: 0x9fd0ff },
    model: { skin: 0xf1d2b6, hair: 'sasuke', hairColor: 0x1a1c2a, top: 0xd9d9e3, under: 0xd9d9e3, pants: 0x2b2b3a, belt: 0x7b5bb0, boots: 0x2b2b3a, gloves: null, sword: 'katana' }
  },
  {
    slot: 8, id: 'anos', name: 'Anos Voldigoad', series: 'The Misfit of Demon King Academy', portrait: P('anos-voldigoad'),
    style: 'Powerful magical spells',
    aura: 0x3b1f5c,
    stats: { speed: 6.9, light: 42, heavy: 92, lightRange: 1.7, heavyRange: 2.6, weight: 0.35 },
    special: { name: 'Dark Flame Sphere', desc: 'Casts a slow homing sphere of black-violet magic that detonates.', type: 'projectile', cooldown: 8, damage: 180, speed: 11, radius: 0.9, count: 1, explode: 2.8, homing: 2.4, charge: 0.5, color: 0x7a2cff },
    model: { skin: 0xf2d6c0, hair: 'anos', hairColor: 0x121218, top: 0x16161e, under: 0xf2f2f2, pants: 0x16161e, belt: 0xc9a43a, boots: 0x16161e, gloves: null, coat: 0x16161e }
  },
  {
    slot: 9, id: 'gojo', name: 'Satoru Gojo', series: 'Jujutsu Kaisen', portrait: null, portraitColors: ['#2a3a6a', '#9ad7ff'],
    style: 'Defensive abilities',
    aura: 0x8fd8ff,
    stats: { speed: 7.2, light: 40, heavy: 84, lightRange: 1.75, heavyRange: 2.2, weight: 0.3 },
    special: { name: 'Infinity Burst', desc: 'Raises Infinity (no damage taken), pulls the opponent in through space, then repels them in a burst.', type: 'gojo', cooldown: 10, damage: 125, pullRange: 9, radius: 3.4, guard: 1.6, charge: 0.25, knock: 15, color: 0x8fd8ff },
    model: { skin: 0xf5ddc8, hair: 'gojo', hairColor: 0xf4f6ff, top: 0x15182a, under: 0x15182a, pants: 0x15182a, belt: 0x15182a, boots: 0x101010, gloves: null, blindfold: 0x0c0c10 }
  },
  {
    slot: 10, id: 'sukuna', name: 'Ryomen Sukuna', series: 'Jujutsu Kaisen', portrait: null, portraitColors: ['#4a0f1a', '#ff8fb0'],
    style: 'Rapid cutting attacks',
    aura: 0xff3355,
    stats: { speed: 7.4, light: 40, heavy: 90, lightRange: 1.8, heavyRange: 2.3, weight: 0.3 },
    special: { name: 'Dismantle', desc: 'Unleashes a storm of invisible cuts across a long range in front of him.', type: 'flurry', cooldown: 8, damage: 24, hits: 8, interval: 0.07, range: 6.5, arc: 50, charge: 0.3, knock: 3, color: 0xff5577 },
    model: { skin: 0xf0cdb4, hair: 'sukuna', hairColor: 0xf28fae, top: 0xf2efe8, under: 0xf2efe8, pants: 0xf2efe8, belt: 0x1a1a1a, boots: 0x1a1a1a, gloves: null, markings: 0x111111 }
  },
  {
    slot: 11, id: 'tanjiro', name: 'Tanjiro Kamado', series: 'Demon Slayer', portrait: P('tanjiro-kamado'),
    style: 'Water-style sword combos',
    aura: 0x3fa9ff,
    stats: { speed: 7.4, light: 41, heavy: 86, lightRange: 2.0, heavyRange: 2.4, weight: 0.25 },
    special: { name: 'Water Wheel Dance', desc: 'A flowing water-style sword dash that cuts five times.', type: 'dash', cooldown: 8, damage: 34, hits: 5, interval: 0.08, dashSpeed: 14, dashTime: 0.5, range: 2.1, charge: 0.25, knock: 1.5, color: 0x5ec8ff },
    model: { skin: 0xf3cfb0, hair: 'tanjiro', hairColor: 0x6a1a1a, top: 0x1d1d22, under: 0x1d1d22, pants: 0x1d1d22, belt: 0xf2f2f2, boots: 0xf2f2f2, gloves: null, haori: 'checker', sword: 'katana' }
  },
  {
    slot: 12, id: 'ichigo', name: 'Ichigo Kurosaki', series: 'Bleach', portrait: P('ichigo-kurosaki'),
    style: 'Fast dashes',
    aura: 0x9fe8ff,
    stats: { speed: 7.6, light: 41, heavy: 90, lightRange: 2.1, heavyRange: 2.6, weight: 0.3 },
    special: { name: 'Getsuga Tensho', desc: 'Swings his blade and launches a crescent of sword energy.', type: 'projectile', cooldown: 7.5, damage: 165, speed: 22, radius: 1.1, count: 1, explode: 0, flat: true, charge: 0.35, color: 0x9fe8ff },
    model: { skin: 0xf3d0b0, hair: 'ichigo', hairColor: 0xff8a1f, top: 0x111114, under: 0xf2f2f2, pants: 0x111114, belt: 0xf2f2f2, boots: 0x111114, gloves: null, sword: 'cleaver' }
  },
  {
    slot: 13, id: 'luffy', name: 'Monkey D. Luffy', series: 'One Piece', portrait: P('monkey-d-luffy'),
    style: 'Extended attack range',
    aura: 0xff5a4a,
    stats: { speed: 7.1, light: 36, heavy: 80, lightRange: 2.3, heavyRange: 2.8, weight: 0.2 },
    special: { name: 'Gum-Gum Gatling', desc: 'A barrage of elastic punches that reaches far across the ring.', type: 'flurry', cooldown: 8, damage: 19, hits: 10, interval: 0.06, range: 6.0, arc: 40, charge: 0.25, knock: 2, stretch: true, color: 0xffe0c0 },
    model: { skin: 0xf0c49a, hair: 'luffy', hairColor: 0x111111, top: 0xd8262b, under: 0xf0c49a, pants: 0x2f5fb8, belt: 0xf2d23a, boots: 0x8a5a2a, gloves: null, hat: 0xf2d27a }
  },
  {
    slot: 14, id: 'zoro', name: 'Roronoa Zoro', series: 'One Piece', portrait: P('roronoa-zoro'),
    style: 'Three-sword attacks',
    aura: 0x5fd17a,
    stats: { speed: 7.0, light: 45, heavy: 94, lightRange: 2.1, heavyRange: 2.4, weight: 0.35 },
    special: { name: 'Three-Sword Tornado', desc: 'Spins with three swords, slicing everything around him four times.', type: 'spin', cooldown: 8, damage: 48, hits: 4, interval: 0.17, radius: 3.0, charge: 0.25, knock: 1.5, color: 0x8af0a0 },
    model: { skin: 0xe7b98e, hair: 'zoro', hairColor: 0x3fbf5a, top: 0x2f6b3a, under: 0x2f6b3a, pants: 0x1b1b1b, belt: 0x8a1f2b, boots: 0x111111, gloves: null, sword: 'three' }
  },
  {
    slot: 15, id: 'madara', name: 'Madara Uchiha', series: 'Naruto', portrait: P('madara-uchiha'),
    style: 'Powerful ninja abilities',
    aura: 0xff6a2a,
    stats: { speed: 6.9, light: 43, heavy: 94, lightRange: 1.75, heavyRange: 2.5, weight: 0.4 },
    special: { name: 'Great Fire Annihilation', desc: 'Breathes a massive fire-style fireball that engulfs on impact.', type: 'projectile', cooldown: 9, damage: 185, speed: 13, radius: 1.3, count: 1, explode: 3.2, charge: 0.5, color: 0xff6a2a },
    model: { skin: 0xf0d2bb, hair: 'madara', hairColor: 0x121218, top: 0xa3242a, under: 0x1d1d26, pants: 0x1d1d26, belt: 0x1d1d26, boots: 0x1d1d26, gloves: null, armor: 0xa3242a }
  },
  {
    slot: 16, id: 'gogeta', name: 'Gogeta', series: 'Dragon Ball', portrait: P('gogeta'),
    style: 'Extremely fast combat and teleportation attacks',
    aura: 0xffd23a,
    stats: { speed: 8.2, light: 44, heavy: 92, lightRange: 1.8, heavyRange: 2.2, weight: 0.3 },
    special: { name: 'Stardust Breaker', desc: 'Teleports behind the opponent and slams a rainbow energy sphere into them.', type: 'teleport', cooldown: 10, damage: 205, range: 2.4, charge: 0.2, knock: 14, color: 0xffd23a },
    model: { skin: 0xf2c79e, hair: 'gogeta', hairColor: 0x15151c, top: 0x1a1a22, under: 0xf2c79e, pants: 0xf4f4f4, belt: 0xf08a1c, boots: 0x111111, gloves: null, vest: 0xc4262b }
  },
  {
    slot: 17, id: 'new-challenger', name: 'NEW CHALLENGER', reserved: true,
    style: 'To be defined', special: null
  }
];

export const PLAYABLE = ROSTER.filter((f) => !f.reserved);
export const byId = (id) => ROSTER.find((f) => f.id === id);
