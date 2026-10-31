/* 花之境界 Online v0.1 — 單人試玩版（原創美術，Canvas 繪製） */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const W = 960, H = 540, GROUND = 470, MAP_W = 4200;
const SAVE_KEY = 'hanaRealm.save.v1';
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---------- 資料 ---------- */
const CLASSES = {
  knight: { name: '聖薔薇騎士', desc: '近戰・高血量', hp: 120, mp: 30, atk: 12, range: 70, type: 'melee', crit: .1, weapon: 'sword',
    skill: { name: '薔薇斬擊', mp: 8, cd: 2.5, mult: 2.2, range: 150, max: 4, kind: 'slash' } },
  mage: { name: '星詠魔導士', desc: '遠程・範圍魔法', hp: 80, mp: 70, atk: 13, range: 320, type: 'proj', proj: 'star', crit: .1, weapon: 'staff',
    skill: { name: '流星花雨', mp: 14, cd: 3, mult: 1.9, range: 380, max: 5, kind: 'meteor' } },
  ranger: { name: '月影遊俠', desc: '遠程・高爆擊', hp: 90, mp: 45, atk: 11, range: 360, type: 'proj', proj: 'arrow', crit: .25, weapon: 'bow',
    skill: { name: '月影箭', mp: 9, cd: 2.2, mult: 2.6, range: 520, max: 6, kind: 'pierce' } },
  priest: { name: '花語聖職者', desc: '治療・輔助', hp: 95, mp: 60, atk: 10, range: 80, type: 'melee', crit: .1, weapon: 'wand',
    skill: { name: '花之治癒', mp: 12, cd: 4, mult: 1.6, range: 140, max: 5, kind: 'heal' } }
};
const HAIRS = { short: '短髮', bob: '鮑伯頭', long: '長直髮', twin: '雙馬尾', pony: '馬尾', spiky: '刺蝟頭' };
const HAIR_COLORS = ['#3b2a2a', '#7a4b2e', '#f4c46a', '#ff9ec4', '#b48cff', '#7ec8ff', '#f2f2f2', '#ff6b6b'];
const EYE_SHAPES = { round: '圓眼', gentle: '溫柔', sharp: '銳利', sleepy: '慵懶' };
const EYE_COLORS = ['#5b3a29', '#3d6bd9', '#2fa37a', '#c0458f', '#8a55e6', '#e8a23a'];
const SKINS = ['#ffe9dc', '#ffd9c2', '#f3c19f', '#d99c74', '#a8704c'];
const OUTFITS = ['#ff8fb6', '#9ec0ff', '#ffffff', '#b48cff', '#7fd8a8', '#ffd76a', '#ff6b6b', '#3b3550'];
const OUTFIT_FREE = 4;   // 前 4 種免費，其餘抽卡解鎖
const DECOS = { none: '無', blush: '腮紅', mole: '淚痣', star: '星星貼紙', glasses: '圓框眼鏡' };

const ITEMS = {
  iron: { n: '鐵礦', e: '🪨', sell: 4 }, crystal: { n: '月光水晶', e: '💎', sell: 12 }, star: { n: '星辰礦石', e: '✨', sell: 30 },
  dew: { n: '花露', e: '💧', sell: 3 }, dust: { n: '月光鱗粉', e: '🦋', sell: 6 }, leaf: { n: '精靈葉', e: '🍃', sell: 9 },
  hpPot: { n: '紅藥水', e: '❤️' }, mpPot: { n: '藍藥水', e: '🔷' }, ticket: { n: '召喚券', e: '🎫' }
};
const MONSTERS = {
  slime: { name: '花露史萊姆', lv: 1, hp: 45, atk: 7, exp: 9, spd: 45, w: 42, h: 34, gold: [3, 8], drop: ['dew', .5], col: '#ff9ec4' },
  bfly: { name: '月光蝶', lv: 3, hp: 80, atk: 11, exp: 18, spd: 70, w: 44, h: 36, gold: [6, 14], drop: ['dust', .45], col: '#b9a6ff', fly: true },
  sprite: { name: '森林小精靈', lv: 5, hp: 140, atk: 16, exp: 34, spd: 60, w: 40, h: 46, gold: [12, 24], drop: ['leaf', .45], col: '#7fd8a8' },
  golem: { name: '水晶石偶', lv: 8, hp: 320, atk: 24, exp: 80, spd: 35, w: 64, h: 66, gold: [30, 55], drop: ['crystal', .6], col: '#9ad7ff' }
};
const ORES = { iron: { n: '鐵礦', hp: 3, col: '#9a8f8a', gem: '#c9c0bb', respawn: 12 }, crystal: { n: '月光水晶', hp: 5, col: '#7f78b8', gem: '#bfe6ff', respawn: 18 }, star: { n: '星辰礦石', hp: 8, col: '#5a4f7a', gem: '#ffe58a', respawn: 30 } };
const PETS = { dog: { n: '小柴犬', e: '🐶' }, cat: { n: '奶油貓', e: '🐱' }, lizard: { n: '翡翠蜥蜴', e: '🦎' }, snake: { n: '櫻花小蛇', e: '🐍' } };
const MOUNTS = { deer: { n: '櫻花鹿', e: '🦌', spd: 1.45 } };

/* ---------- 地圖 ---------- */
const ZONES = [
  { from: 0, to: 950, name: '櫻華王都', sky: ['#ffd9e8', '#fff5ec'], hill: '#f6c9da', safe: true },
  { from: 950, to: 2350, name: '花露草原', sky: ['#cfe9ff', '#fff7ef'], hill: '#bfe3c9' },
  { from: 2350, to: 3500, name: '月影森林', sky: ['#5b4c8f', '#c9b3ff'], hill: '#4a6b6a' },
  { from: 3500, to: MAP_W, name: '水晶礦洞', sky: ['#2c2547', '#5d5590'], hill: '#3c3560' }
];
const PLATS = [
  { x: 1150, y: 380, w: 200 }, { x: 1450, y: 320, w: 180 }, { x: 1750, y: 380, w: 220 }, { x: 2050, y: 300, w: 160 },
  { x: 2450, y: 370, w: 240 }, { x: 2760, y: 300, w: 200 }, { x: 3050, y: 230, w: 180 }, { x: 3230, y: 360, w: 200 },
  { x: 3600, y: 380, w: 220 }, { x: 3880, y: 300, w: 220 }
];
const NPCS = [
  { id: 'forge', x: 266, name: '鍛造師 蘿絲', e: '⚒️', col: '#ff9e7a', hair: '#7a4b2e' },
  { id: 'shop', x: 456, name: '花之商店 米米', e: '🛍️', col: '#9ec0ff', hair: '#f4c46a' },
  { id: 'gacha', x: 646, name: '星願召喚殿', e: '✨', col: '#b48cff', hair: '#f2f2f2' },
  { id: 'salon', x: 836, name: '美容院 小葵', e: '💇', col: '#ff8fb6', hair: '#ff9ec4' }
];
const SPAWNS = [
  ['slime', 1100, GROUND], ['slime', 1300, GROUND], ['slime', 1600, GROUND], ['slime', 1900, GROUND], ['slime', 2150, GROUND],
  ['bfly', 1540, 320], ['bfly', 1860, 380], ['bfly', 2130, 300],
  ['sprite', 2500, GROUND], ['sprite', 2750, GROUND], ['sprite', 3000, GROUND], ['bfly', 2570, 370], ['sprite', 2860, 300], ['bfly', 3140, 230], ['sprite', 3330, 360],
  ['golem', 3700, GROUND], ['golem', 4000, GROUND], ['sprite', 3700, 380]
];
const ORE_SPOTS = [['iron', 1230, GROUND], ['iron', 1700, GROUND], ['iron', 2000, GROUND], ['iron', 1520, 320], ['crystal', 2620, GROUND], ['crystal', 2850, 300], ['crystal', 3600, GROUND], ['star', 3130, 230], ['star', 3990, 300], ['crystal', 3950, GROUND]];

/* ---------- 存檔 ---------- */
let S = null;
function newSave(look, name, cls) {
  const c = CLASSES[cls];
  return { v: 1, name, cls, look, lv: 1, exp: 0, hp: c.hp, mp: c.mp, gold: 50, weaponLv: 0, pickLv: 1,
    inv: { iron: 0, crystal: 0, star: 0, dew: 0, dust: 0, leaf: 0, hpPot: 5, mpPot: 3, ticket: 3 },
    outfits: [0, 1, 2, 3], pets: [], pet: null, mounts: [], mount: null, riding: false, x: 120, kills: 0 };
}
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 1 ? s : null; } catch { return null; } }
function persist() { if (!S) return; try { S.x = P ? Math.round(P.x) : S.x; localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} }
const stats = () => { const c = CLASSES[S.cls]; return { maxHp: c.hp + (S.lv - 1) * 22, maxMp: c.mp + (S.lv - 1) * 9, atk: c.atk + (S.lv - 1) * 3 + S.weaponLv * 5 }; };
const expNeed = lv => Math.round(18 * Math.pow(lv, 1.55));

/* ---------- 角色繪製 ---------- */
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * f), 0, 255); g = clamp(Math.round(g * f), 0, 255); b = clamp(Math.round(b * f), 0, 255); return `rgb(${r},${g},${b})`; }
function drawWeapon(g, kind, swing) {
  g.save(); g.rotate(-0.6 + swing * 2.2);
  if (kind === 'sword') { g.fillStyle = '#e9eef7'; g.fillRect(-2, -30, 5, 26); g.fillStyle = '#ff8fb6'; g.fillRect(-6, -5, 13, 4); g.fillStyle = '#8a5a3c'; g.fillRect(-1.5, -1, 4, 8); }
  else if (kind === 'staff') { g.fillStyle = '#8a5a3c'; g.fillRect(-1.5, -30, 3.5, 38); g.fillStyle = '#ffe58a'; star(g, 0, -33, 7, 3.2); }
  else if (kind === 'bow') { g.strokeStyle = '#8a5a3c'; g.lineWidth = 3; g.beginPath(); g.arc(-6, -10, 16, -1.2, 1.2); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6 + 16 * Math.cos(-1.2), -10 + 16 * Math.sin(-1.2)); g.lineTo(-6 + 16 * Math.cos(1.2), -10 + 16 * Math.sin(1.2)); g.stroke(); }
  else { g.fillStyle = '#c9a26b'; g.fillRect(-1.5, -24, 3, 30); g.fillStyle = '#ff8fb6'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.cos(i * 1.256) * 4.5, -27 + Math.sin(i * 1.256) * 4.5, 3.4, 0, 7); g.fill(); } g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(0, -27, 2.5, 0, 7); g.fill(); }
  g.restore();
}
function star(g, x, y, r, r2) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r2 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
function drawEyes(g, look, fx, blink) {
  const ex = [-7 + fx, 7 + fx], y = -42;
  ex.forEach((x, i) => {
    if (blink) { g.strokeStyle = '#3a2a35'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.stroke(); return; }
    const sh = look.eyeShape;
    let w = 4.4, h = 6;
    if (sh === 'round') { w = 4.8; h = 6; } if (sh === 'gentle') { h = 5; } if (sh === 'sharp') { w = 4.6; h = 4.6; } if (sh === 'sleepy') { h = 3.6; }
    g.fillStyle = '#2a1f2a'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill();
    g.fillStyle = look.eye; g.beginPath(); g.ellipse(x, y + 1, w - 1.2, h - 1.4, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1.4, y - 2, 1.6, 0, 7); g.fill(); g.beginPath(); g.arc(x + 1.5, y + 2, .8, 0, 7); g.fill();
    g.strokeStyle = '#2a1f2a'; g.lineWidth = 1.6; g.beginPath();
    if (sh === 'sharp') { g.moveTo(x - 5, y - h + (i ? 1 : -1)); g.lineTo(x + 5, y - h + (i ? -1 : 1)); }
    else if (sh === 'sleepy') { g.moveTo(x - 5, y - h + 1); g.lineTo(x + 5, y - h + 1); }
    else { g.arc(x, y + 1, w + .6, Math.PI * 1.15, Math.PI * 1.85); }
    g.stroke();
  });
}
function drawHairBack(g, look) {
  g.fillStyle = look.hairColor;
  if (look.hair === 'long') { g.beginPath(); g.roundRect(-19, -52, 38, 46, 10); g.fill(); }
  if (look.hair === 'twin') { [[-22, -34], [22, -34]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 7, 14, x < 0 ? .3 : -.3, 0, 7); g.fill(); }); }
  if (look.hair === 'pony') { g.beginPath(); g.ellipse(0, -30, 7, 16, 0, 0, 7); g.fill(); }
}
function drawHairFront(g, look, fx) {
  const c = look.hairColor; g.fillStyle = c;
  g.beginPath(); g.arc(0, -46, 19.5, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(19, -40); g.quadraticCurveTo(8 + fx, -50, -2 + fx, -40); g.quadraticCurveTo(-10 + fx, -50, -19, -40); g.closePath(); g.fill();
  if (look.hair === 'bob') { g.beginPath(); g.roundRect(-20, -48, 7, 18, 4); g.roundRect(13, -48, 7, 18, 4); g.fill(); }
  if (look.hair === 'spiky') { for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 8 - 6, -60); g.lineTo(i * 8, -72 + Math.abs(i) * 3); g.lineTo(i * 8 + 6, -60); g.fill(); } }
  if (look.hair === 'long' || look.hair === 'twin') { g.beginPath(); g.roundRect(-20, -48, 5, 20, 3); g.roundRect(15, -48, 5, 20, 3); g.fill(); }
  if (look.hair === 'twin') { g.fillStyle = '#ff6b9a'; g.beginPath(); g.arc(-17, -58, 3, 0, 7); g.arc(17, -58, 3, 0, 7); g.fill(); }
  if (look.hair === 'pony') { g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(0, -64, 3, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-6, -58, 6, 2, -.3, 0, 7); g.fill();
}
/* (x,y)=腳底中心；opt: face(1/-1) walk(0..) atk(0..1) scale */
function drawChibi(g, x, y, look, cls, opt = {}) {
  const f = opt.face || 1, sc = opt.scale || 1, wt = opt.walk || 0, at = opt.atk || 0;
  g.save(); g.translate(x, y); g.scale(sc, sc);
  g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(0, 0, 16, 4, 0, 0, 7); g.fill();
  const bob = Math.abs(Math.sin(wt * 10)) * 1.5;
  g.translate(0, -bob);
  g.scale(f, 1);
  drawHairBack(g, look);
  const leg = Math.sin(wt * 10) * 4;
  g.fillStyle = shade(look.outfit, .6); g.beginPath(); g.roundRect(-8 + leg * .5, -12, 7, 12, 3); g.roundRect(1 - leg * .5, -12, 7, 12, 3); g.fill();
  g.fillStyle = '#5a4050'; g.beginPath(); g.roundRect(-9 + leg * .5, -3, 9, 4, 2); g.roundRect(0 - leg * .5, -3, 9, 4, 2); g.fill();
  g.fillStyle = look.outfit; g.beginPath(); g.moveTo(-11, -27); g.lineTo(11, -27); g.lineTo(14, -9); g.lineTo(-14, -9); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-5, -27); g.lineTo(0, -21); g.lineTo(5, -27); g.fill();
  g.fillStyle = shade(look.outfit, .85); g.fillRect(-14, -12, 28, 3);
  g.fillStyle = look.skin; g.beginPath(); g.arc(-12, -17 - leg * .3, 3.5, 0, 7); g.fill();
  g.save(); g.translate(12, -18); drawWeapon(g, CLASSES[cls].weapon, at); g.fillStyle = look.skin; g.beginPath(); g.arc(0, 0, 3.6, 0, 7); g.fill(); g.restore();
  g.fillStyle = look.skin; g.beginPath(); g.arc(0, -44, 18, 0, 7); g.fill();
  g.fillStyle = look.skin; g.beginPath(); g.ellipse(-18, -42, 3, 4, 0, 0, 7); g.ellipse(18, -42, 3, 4, 0, 0, 7); g.fill();
  const fx = 2.5;
  drawEyes(g, look, fx, opt.blink);
  if (look.deco === 'blush' || look.deco === 'star' || look.deco === 'mole') { g.fillStyle = 'rgba(255,120,160,.38)'; g.beginPath(); g.ellipse(-9 + fx, -35, 4, 2.4, 0, 0, 7); g.ellipse(11 + fx, -35, 4, 2.4, 0, 0, 7); g.fill(); }
  if (look.deco === 'mole') { g.fillStyle = '#4a3040'; g.beginPath(); g.arc(12 + fx, -37, .9, 0, 7); g.fill(); }
  if (look.deco === 'star') { g.fillStyle = '#ffd34d'; star(g, -12 + fx, -36, 3.4, 1.5); }
  g.strokeStyle = '#a0506e'; g.lineWidth = 1.4; g.beginPath(); g.arc(1.5 + fx, -35, 2.4, .2, Math.PI - .2); g.stroke();
  if (look.deco === 'glasses') { g.strokeStyle = '#6a4a5a'; g.lineWidth = 1.3; g.beginPath(); g.arc(-7 + fx, -42, 6, 0, 7); g.moveTo(13 + fx, -42); g.arc(7 + fx, -42, 6, 0, 7); g.moveTo(-1 + fx, -42); g.lineTo(1 + fx, -42); g.stroke(); }
  drawHairFront(g, look, fx);
  g.restore();
}
function drawPet(g, id, x, y, t) {
  g.save(); g.translate(x, y + Math.sin(t * 8) * 1.2);
  g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(0, 0, 11, 3, 0, 0, 7); g.fill();
  const body = { dog: '#e9a65f', cat: '#fff1d6', lizard: '#5fcf8a', snake: '#ff9ec4' }[id];
  g.fillStyle = body;
  if (id === 'snake') { g.lineWidth = 7; g.strokeStyle = body; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14, -4); g.quadraticCurveTo(-7, -12 + Math.sin(t * 6) * 3, 0, -4); g.quadraticCurveTo(6, 3, 10, -8); g.stroke(); g.beginPath(); g.arc(11, -11, 5.5, 0, 7); g.fill(); g.fillStyle = '#2a1f2a'; g.beginPath(); g.arc(13, -12, 1.2, 0, 7); g.fill(); }
  else if (id === 'lizard') { g.beginPath(); g.ellipse(0, -6, 12, 5.5, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(12, -8, 6, 4.5, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-10, -6); g.quadraticCurveTo(-20, -8 + Math.sin(t * 7) * 3, -24, -2); g.lineTo(-10, -3); g.fill(); g.fillStyle = '#2a1f2a'; g.beginPath(); g.arc(14, -10, 1.3, 0, 7); g.fill(); }
  else { g.beginPath(); g.ellipse(0, -8, 10, 7, 0, 0, 7); g.fill(); g.beginPath(); g.arc(8, -16, 7.5, 0, 7); g.fill();
    if (id === 'cat') { g.beginPath(); g.moveTo(3, -21); g.lineTo(5, -28); g.lineTo(9, -22); g.moveTo(9, -22); g.lineTo(13, -28); g.lineTo(14, -20); g.fill(); }
    else { g.fillStyle = shade(body, .8); g.beginPath(); g.ellipse(3, -19, 3, 5, .5, 0, 7); g.ellipse(13, -19, 3, 5, -.5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(10, -13, 4, 3, 0, 0, 7); g.fill(); }
    g.fillStyle = '#2a1f2a'; g.beginPath(); g.arc(6, -17, 1.3, 0, 7); g.arc(11, -17, 1.3, 0, 7); g.fill(); g.fillStyle = body; g.beginPath(); g.ellipse(-10, -12 + Math.sin(t * 9) * 2, 2.5, 5, -.6, 0, 7); g.fill(); }
  g.restore();
}
function drawMount(g, x, y, f, t) {
  g.save(); g.translate(x, y); g.scale(f, 1);
  const s = Math.sin(t * 12) * 3;
  g.fillStyle = '#e8a77a'; g.beginPath(); g.ellipse(0, -18, 24, 10, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; [[-12, -20], [-2, -22], [9, -19]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 2, 0, 7); g.fill(); });
  g.fillStyle = '#c98a5e'; [[-16, s], [-8, -s], [10, s], [17, -s]].forEach(([a, d]) => { g.fillRect(a - 2, -12, 4, 12 + d * .2); });
  g.fillStyle = '#e8a77a'; g.beginPath(); g.ellipse(24, -30, 8, 7, 0, 0, 7); g.fill(); g.fillRect(18, -30, 7, 12);
  g.strokeStyle = '#ff9ec4'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(22, -36); g.lineTo(18, -46); g.lineTo(14, -48); g.moveTo(18, -46); g.lineTo(20, -52); g.moveTo(27, -36); g.lineTo(31, -46); g.lineTo(35, -48); g.moveTo(31, -46); g.lineTo(29, -52); g.stroke();
  g.fillStyle = '#2a1f2a'; g.beginPath(); g.arc(27, -31, 1.5, 0, 7); g.fill();
  g.restore();
}

/* ---------- 畫面切換 ---------- */
const screens = ['gate', 'title', 'create', 'play'];
function show(id) { screens.forEach(s => $('#' + s).classList.toggle('show', s === id)); if (id === 'play') { resize(); running = true; } else running = false; }

/* ---------- 會員檢查 ---------- */
let gateDone = false;
function onMember(m) {
  if (gateDone) return;
  if (m && m.user) { gateDone = true; toTitle(); }
  else { $('#gateMsg').textContent = '《花之境界 Online》是會員專屬遊戲，請先登入會員 ✿'; $('#gateBtns').hidden = false; }
}
document.addEventListener('jasmine-member', e => onMember(e.detail));
if (window.jasmineMember && window.jasmineMember.ready) onMember(window.jasmineMember);
setTimeout(() => { if (!gateDone && $('#gateBtns').hidden) onMember(null); }, 7000);
document.querySelectorAll('[data-mz-open]').forEach(b => b.addEventListener('click', () => window.jasmineMembers && window.jasmineMembers.open(b.dataset.mzOpen)));

function toTitle() {
  S = load();
  $('#btnStart').textContent = S ? `繼續冒險（${S.name} Lv.${S.lv}）` : '開始冒險';
  $('#btnNew').hidden = !S;
  show('title');
}
$('#btnStart').onclick = () => { if (S) startPlay(); else openCreate(false); };
$('#btnNew').onclick = () => { if (confirm('重新創角會清除目前角色的進度，確定嗎？')) { localStorage.removeItem(SAVE_KEY); S = null; openCreate(false); } };

/* ---------- 捏臉 ---------- */
let draft = null, editing = false;
const pv = $('#pv'), pg = pv.getContext('2d');
function randomLook() { return { hair: pick(Object.keys(HAIRS)), hairColor: pick(HAIR_COLORS), eyeShape: pick(Object.keys(EYE_SHAPES)), eye: pick(EYE_COLORS), skin: pick(SKINS), outfit: OUTFITS[rint(0, OUTFIT_FREE - 1)], deco: pick(Object.keys(DECOS)) }; }
function opts(el, entries, key, swatch) {
  el.innerHTML = '';
  entries.forEach(([val, label, locked]) => {
    const b = document.createElement('button'); b.type = 'button';
    if (swatch) { b.style.background = val; b.title = locked ? '抽卡解鎖' : ''; if (locked) b.classList.add('locked'); }
    else b.innerHTML = label;
    if (draft[key] === val) b.classList.add('on');
    b.onclick = () => { if (locked) return; draft[key] = val; renderCreate(); };
    el.appendChild(b);
  });
}
function renderCreate() {
  opts($('#optCls'), Object.entries(CLASSES).map(([k, c]) => [k, `<b>${c.name}</b><small>${c.desc}</small>`]), 'cls');
  if (editing) $('#optCls').querySelectorAll('button').forEach(b => { b.disabled = !b.classList.contains('on'); });
  opts($('#optHair'), Object.entries(HAIRS), 'hair');
  opts($('#optHairColor'), HAIR_COLORS.map(c => [c]), 'hairColor', true);
  opts($('#optEyeShape'), Object.entries(EYE_SHAPES), 'eyeShape');
  opts($('#optEye'), EYE_COLORS.map(c => [c]), 'eye', true);
  opts($('#optSkin'), SKINS.map(c => [c]), 'skin', true);
  const owned = editing && S ? S.outfits : [0, 1, 2, 3];
  opts($('#optOutfit'), OUTFITS.map((c, i) => [c, '', !owned.includes(i)]), 'outfit', true);
  opts($('#optDeco'), Object.entries(DECOS), 'deco');
  pg.clearRect(0, 0, 320, 360);
  drawChibi(pg, 160, 300, draft, draft.cls, { scale: 3.4, face: 1 });
}
function openCreate(edit) {
  editing = edit;
  draft = edit ? { ...S.look, cls: S.cls } : { ...randomLook(), cls: 'knight' };
  $('#inName').value = edit ? S.name : ''; $('#inName').disabled = edit;
  $('#createTitle').textContent = edit ? '美容院：重新打扮' : '創造你的角色';
  $('#btnCreate').textContent = edit ? '儲存造型' : '完成，進入王都 →';
  $('#btnCancelCreate').hidden = !edit;
  renderCreate(); show('create');
}
$('#btnRandom').onclick = () => { const cls = draft.cls; draft = { ...randomLook(), cls }; if (editing && S) draft.outfit = OUTFITS[pick(S.outfits)]; renderCreate(); };
$('#btnCancelCreate').onclick = () => show('play');
$('#btnCreate').onclick = () => {
  const { cls, ...look } = draft;
  if (editing) { S.look = look; persist(); show('play'); toast('造型已更新 ✿'); refreshFace(); return; }
  const name = $('#inName').value.trim();
  if (!name) { $('#inName').focus(); $('#inName').placeholder = '請先取個名字喔！'; return; }
  S = newSave(look, name, cls); persist(); startPlay(true);
};

/* ---------- 遊戲狀態 ---------- */
const cv = $('#cv'), g = cv.getContext('2d');
let P, mobs = [], ores = [], drops = [], projs = [], fx = [], texts = [], petals = [];
let cam = 0, running = false, last = 0, T = 0, auto = false, saveTimer = 0;
const keys = {};
function startPlay(first) {
  const st = stats();
  P = { x: S.x || 120, y: GROUND, vx: 0, vy: 0, w: 28, h: 64, face: 1, onG: true, walk: 0, atkT: 0, atkCd: 0, skCd: 0, inv: 0, blinkT: 2, dropT: 0 };
  S.hp = clamp(S.hp, 1, st.maxHp); S.mp = clamp(S.mp, 0, st.maxMp);
  mobs = SPAWNS.map(([type, x, y]) => spawnMob(type, x, y));
  ores = ORE_SPOTS.map(([type, x, y]) => ({ type, x, y, hp: ORES[type].hp, dead: 0 }));
  drops = []; projs = []; fx = []; texts = [];
  petals = Array.from({ length: 26 }, () => ({ x: rnd(0, W), y: rnd(-H, H), s: rnd(.6, 1.3), v: rnd(20, 50), r: rnd(0, 6) }));
  refreshFace(); updateHud(); show('play');
  if (first) setTimeout(() => toast('歡迎來到櫻華王都！往右走進花露草原打怪吧 →'), 400);
}
function spawnMob(type, x, y) {
  const d = MONSTERS[type];
  let minX = x - 120, maxX = x + 120;
  const pl = PLATS.find(p => Math.abs(p.y - y) < 2 && x >= p.x && x <= p.x + p.w);
  if (pl) { minX = pl.x + 20; maxX = pl.x + pl.w - 20; }
  return { type, d, x, y, hx: x, hy: y, hp: d.hp, vx: (Math.random() < .5 ? -1 : 1) * d.spd, minX, maxX, hitT: 0, dead: 0, aggro: 0, atkCd: 0, t: rnd(0, 6) };
}

/* ---------- 輸入 ---------- */
const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ' ': 'jump', ArrowUp: 'jump', w: 'jump', W: 'jump', ArrowDown: 'down', s: 'down', S: 'down', j: 'attack', J: 'attack', Control: 'attack', k: 'skill', K: 'skill', e: 'act', E: 'act' };
addEventListener('keydown', e => {
  if (!running || !$('#panel').hidden) { if (e.key === 'Escape') closePanel(); return; }
  if (e.target.tagName === 'INPUT') return;
  const k = KEYMAP[e.key];
  if (k) { keys[k] = true; e.preventDefault(); if (k === 'act') interact(); }
  if (e.key === 'q' || e.key === 'Q') toggleAuto();
  if (e.key === '1') usePot('hpPot'); if (e.key === '2') usePot('mpPot');
  if (e.key === 'i' || e.key === 'I') openBag();
});
addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
document.querySelectorAll('.touch [data-k]').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); if (k === 'act') interact(); };
  const off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
$('#qHp').onclick = () => usePot('hpPot'); $('#qMp').onclick = () => usePot('mpPot');
$('#qBag').onclick = openBag; $('#qAuto').onclick = toggleAuto; $('#btnMenu').onclick = openMenu;
function toggleAuto() { auto = !auto; $('#qAuto').classList.toggle('on', auto); toast(auto ? '⚔️ 自動打怪：開啟（會自動找怪、放技能、喝藥）' : '自動打怪：關閉'); }

/* ---------- 遊戲邏輯 ---------- */
function zoneAt(x) { return ZONES.find(z => x >= z.from && x < z.to) || ZONES[0]; }
function groundAt(x, y, prevY) { // 回傳可站立的地面 y
  let best = GROUND;
  for (const p of PLATS) if (x >= p.x - 6 && x <= p.x + p.w + 6 && prevY <= p.y + 1 && y >= p.y) best = Math.min(best, p.y);
  return best;
}
function usePot(type) {
  const st = stats();
  if (!S.inv[type]) { toast('沒有' + ITEMS[type].n + '了，去商店買吧'); return; }
  if (type === 'hpPot') { if (S.hp >= st.maxHp) return; S.hp = Math.min(st.maxHp, S.hp + Math.round(st.maxHp * .5)); }
  else { if (S.mp >= st.maxMp) return; S.mp = Math.min(st.maxMp, S.mp + Math.round(st.maxMp * .6)); }
  S.inv[type]--; addText(P.x, P.y - 80, type === 'hpPot' ? '+HP' : '+MP', type === 'hpPot' ? '#ff6b9a' : '#6ea0ff'); updateHud();
}
function nearNpc() { return NPCS.find(n => Math.abs(n.x - P.x) < 55 && P.y > GROUND - 5); }
function nearOre() { return ores.find(o => !o.dead && Math.abs(o.x - P.x) < 55 && Math.abs(o.y - P.y) < 30); }
function interact() {
  const n = nearNpc(); if (n) { openNpc(n.id); return; }
  const o = nearOre(); if (o) { mine(o); return; }
}
function mine(o) {
  if (P.atkCd > 0) return;
  P.atkCd = .4; P.atkT = 1; P.face = o.x > P.x ? 1 : -1;
  o.hp -= S.pickLv; burst(o.x, o.y - 20, ORES[o.type].gem, 6);
  if (o.hp <= 0) {
    o.dead = ORES[o.type].respawn;
    const n = 1 + (Math.random() < .25 + S.pickLv * .05 ? 1 : 0);
    S.inv[o.type] += n; addText(o.x, o.y - 50, `${ITEMS[o.type].e} ${ITEMS[o.type].n} x${n}`, '#fff'); persist();
  }
}
function dmgRoll(mult) { const st = stats(), c = CLASSES[S.cls]; const crit = Math.random() < c.crit; return { v: Math.max(1, Math.round(st.atk * mult * rnd(.85, 1.15) * (crit ? 1.6 : 1))), crit }; }
function hitMob(m, mult) {
  if (m.dead) return;
  const r = dmgRoll(mult); m.hp -= r.v; m.hitT = .25; m.aggro = 6; m.vx = (m.x > P.x ? 1 : -1) * Math.abs(m.d.spd);
  addText(m.x, m.y - m.d.h - 10, r.v, r.crit ? '#ff4d8d' : '#ffb347', r.crit);
  if (m.hp <= 0) killMob(m);
}
function killMob(m) {
  m.dead = 7; S.kills++; burst(m.x, m.y - m.d.h / 2, m.d.col, 14);
  gainExp(m.d.exp);
  drops.push({ kind: 'gold', n: rint(...m.d.gold), x: m.x, y: m.y - 10, vy: -260, vx: rnd(-60, 60), t: 0 });
  if (Math.random() < m.d.drop[1]) drops.push({ kind: m.d.drop[0], n: 1, x: m.x + 10, y: m.y - 10, vy: -300, vx: rnd(-80, 80), t: 0 });
  if (Math.random() < .08) drops.push({ kind: 'hpPot', n: 1, x: m.x - 10, y: m.y - 10, vy: -280, vx: rnd(-60, 60), t: 0 });
  if (Math.random() < .03) drops.push({ kind: 'ticket', n: 1, x: m.x, y: m.y - 10, vy: -320, vx: 0, t: 0 });
}
function gainExp(n) {
  S.exp += n;
  while (S.exp >= expNeed(S.lv)) {
    S.exp -= expNeed(S.lv); S.lv++; S.inv.ticket++;
    const st = stats(); S.hp = st.maxHp; S.mp = st.maxMp;
    fx.push({ kind: 'lvup', x: P.x, y: P.y, t: 0 }); toast(`✨ 升級！Lv.${S.lv}（獲得召喚券 x1）`); persist();
  }
  updateHud();
}
function attack() {
  if (P.atkCd > 0) return;
  const c = CLASSES[S.cls]; P.atkCd = .42; P.atkT = 1;
  if (c.type === 'melee') {
    const hits = mobs.filter(m => !m.dead && Math.abs(m.y - m.d.h / 2 - (P.y - 32)) < 60 && (m.x - P.x) * P.face > -10 && Math.abs(m.x - P.x) < c.range + m.d.w / 2).slice(0, 1);
    hits.forEach(m => hitMob(m, 1)); fx.push({ kind: 'slash', x: P.x + P.face * 30, y: P.y - 32, f: P.face, t: 0 });
  } else projs.push({ kind: c.proj, x: P.x + P.face * 18, y: P.y - 36, vx: P.face * 720, life: c.range / 720, pierce: 0, mult: 1, hit: new Set() });
}
function skill() {
  const c = CLASSES[S.cls], sk = c.skill;
  if (P.skCd > 0 || P.atkCd > 0) return;
  if (S.mp < sk.mp) { if (!auto) toast('MP 不夠！'); return; }
  S.mp -= sk.mp; P.skCd = sk.cd; P.atkCd = .5; P.atkT = 1;
  const inRange = mobs.filter(m => !m.dead && Math.abs(m.x - P.x) < sk.range && Math.abs(m.y - P.y) < 160).sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x));
  if (sk.kind === 'slash') { inRange.filter(m => (m.x - P.x) * P.face > -20).slice(0, sk.max).forEach(m => hitMob(m, sk.mult)); fx.push({ kind: 'rose', x: P.x + P.face * 60, y: P.y - 34, f: P.face, t: 0 }); }
  if (sk.kind === 'meteor') { inRange.slice(0, sk.max).forEach((m, i) => { fx.push({ kind: 'meteor', x: m.x, y: m.y - m.d.h / 2, t: -i * .08, m }); }); if (!inRange.length) fx.push({ kind: 'meteor', x: P.x + P.face * 120, y: P.y - 30, t: 0 }); }
  if (sk.kind === 'pierce') projs.push({ kind: 'moon', x: P.x + P.face * 18, y: P.y - 36, vx: P.face * 900, life: sk.range / 900, pierce: sk.max, mult: sk.mult, hit: new Set() });
  if (sk.kind === 'heal') { const st = stats(); const h = Math.round(st.maxHp * .35); S.hp = Math.min(st.maxHp, S.hp + h); addText(P.x, P.y - 84, '+' + h, '#7ee08f'); inRange.slice(0, sk.max).forEach(m => { if (Math.abs(m.x - P.x) < sk.range) hitMob(m, sk.mult); }); fx.push({ kind: 'bloom', x: P.x, y: P.y, t: 0 }); }
  addText(P.x, P.y - 100, sk.name, '#fff');
  updateHud();
}
function hurtPlayer(n, fromX) {
  if (P.inv > 0) return;
  S.hp -= n; P.inv = 1; P.vx = (P.x < fromX ? -1 : 1) * 260; P.vy = -280; P.onG = false;
  addText(P.x, P.y - 74, n, '#a77bff');
  if (S.hp <= 0) {
    const lost = Math.floor(S.exp * .1); S.exp -= lost; S.hp = Math.round(stats().maxHp * .5);
    P.x = 120; P.y = GROUND; P.vx = P.vy = 0; auto = false; $('#qAuto').classList.remove('on');
    toast(`你倒下了…在王都復活（經驗 -${lost}）`); persist();
  }
  updateHud();
}
function runAuto(dt) {
  const st = stats();
  if (S.hp < st.maxHp * .4 && S.inv.hpPot) usePot('hpPot');
  if (S.mp < st.maxMp * .2 && S.inv.mpPot) usePot('mpPot');
  if (zoneAt(P.x).safe) { keys.right = true; keys.left = false; return; }
  const c = CLASSES[S.cls];
  const alive = mobs.filter(m => !m.dead);
  let tgt = null, bd = 1e9;
  for (const m of alive) { const dy = Math.abs(m.y - P.y), dx = Math.abs(m.x - P.x); const d = dx + dy * 3; if (dx < 700 && d < bd) { bd = d; tgt = m; } }
  keys.left = keys.right = false;
  if (!tgt) return;
  const dx = tgt.x - P.x, dy = tgt.y - P.y, reach = (c.type === 'melee' ? c.range : c.range * .8);
  P.face = dx > 0 ? 1 : -1;
  if (Math.abs(dy) < 60 && Math.abs(dx) < reach) {
    if (P.skCd <= 0 && S.mp >= c.skill.mp && (alive.filter(m => Math.abs(m.x - P.x) < c.skill.range).length > 1 || c.skill.kind === 'heal' && S.hp < st.maxHp * .7 || Math.random() < .02)) skill(); else attack();
  } else {
    if (Math.abs(dx) > 30) keys[dx > 0 ? 'right' : 'left'] = true;
    if (dy < -40 && P.onG && Math.abs(dx) < 140) keys.jumpOnce = true;
    if (dy > 40 && P.onG && P.y < GROUND - 2) keys.dropOnce = true;
  }
}

function update(dt) {
  T += dt;
  const st = stats(), c = CLASSES[S.cls];
  if (auto) runAuto(dt);
  const speed = 230 * (S.riding && S.mount ? MOUNTS[S.mount].spd : 1);
  let mv = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (P.inv > .7) mv = 0;
  if (mv) { P.vx = mv * speed; P.face = mv; P.walk += dt; } else { P.vx *= P.onG ? .7 : .98; if (Math.abs(P.vx) < 5) P.vx = 0; }
  if ((keys.jump || keys.jumpOnce) && P.onG) { if (keys.down && P.y < GROUND - 2) { P.dropT = .25; } else P.vy = -660; P.onG = false; }
  if (keys.dropOnce) { P.dropT = .25; P.onG = false; }
  keys.jumpOnce = keys.dropOnce = false;
  if (keys.attack) attack(); if (keys.skill) skill();
  const prevY = P.y;
  P.vy += 1800 * dt; P.x = clamp(P.x + P.vx * dt, 20, MAP_W - 20); P.y += P.vy * dt;
  P.dropT -= dt;
  const gy = P.dropT > 0 ? GROUND : groundAt(P.x, P.y, prevY);
  if (P.y >= gy && P.vy >= 0) { P.y = gy; P.vy = 0; P.onG = true; } else if (P.y < gy - 1) P.onG = false;
  if (P.onG && !PLATS.some(p => Math.abs(P.y - p.y) < 1 && P.x >= p.x - 6 && P.x <= p.x + p.w + 6) && P.y < GROUND - 1) P.onG = false;
  P.atkCd -= dt; P.skCd -= dt; P.inv -= dt; P.atkT = Math.max(0, P.atkT - dt * 4); P.blinkT -= dt; if (P.blinkT < -.12) P.blinkT = rnd(2, 4);
  if (!zoneAt(P.x).safe && T % 1 < dt) { S.mp = Math.min(st.maxMp, S.mp + 1); }
  if (zoneAt(P.x).safe && T % .5 < dt) { S.hp = Math.min(st.maxHp, S.hp + Math.ceil(st.maxHp * .02)); S.mp = Math.min(st.maxMp, S.mp + 1); }

  for (const m of mobs) {
    if (m.dead) { m.dead -= dt; if (m.dead <= 0) Object.assign(m, spawnMob(m.type, m.hx, m.hy)); continue; }
    m.t += dt; m.hitT -= dt; m.atkCd -= dt; m.aggro -= dt;
    if (m.aggro > 0 && Math.abs(P.y - m.y) < 120) m.vx = (P.x > m.x ? 1 : -1) * m.d.spd * 1.3;
    else if (Math.random() < dt * .4) m.vx = -m.vx;
    m.x += m.vx * dt * (m.hitT > 0 ? .2 : 1);
    if (m.x < m.minX) { m.x = m.minX; m.vx = Math.abs(m.vx); } if (m.x > m.maxX) { m.x = m.maxX; m.vx = -Math.abs(m.vx); }
    if (m.d.fly) m.y = m.hy - 30 + Math.sin(m.t * 2.4) * 18;
    const top = m.y - m.d.h;
    if (Math.abs(m.x - P.x) < (m.d.w / 2 + 12) && P.y > top && P.y - 60 < m.y && m.atkCd <= 0) { hurtPlayer(Math.max(1, Math.round(m.d.atk * rnd(.9, 1.1) - S.lv * .3)), m.x); m.atkCd = 1; }
  }
  for (const o of ores) if (o.dead) { o.dead -= dt; if (o.dead <= 0) { o.dead = 0; o.hp = ORES[o.type].hp; } }
  for (const p of projs) {
    p.x += p.vx * dt; p.life -= dt;
    for (const m of mobs) {
      if (m.dead || p.hit.has(m)) continue;
      if (Math.abs(m.x - p.x) < m.d.w / 2 + 6 && p.y > m.y - m.d.h - 8 && p.y < m.y + 6) { p.hit.add(m); hitMob(m, p.mult); burst(p.x, p.y, p.kind === 'star' ? '#ffe58a' : '#d6e8ff', 5); if (p.pierce-- <= 0) { p.life = 0; break; } }
    }
  }
  projs = projs.filter(p => p.life > 0);
  for (const d of drops) {
    d.t += dt; d.vy += 1400 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= .96;
    const gy2 = groundAt(d.x, d.y, d.y - d.vy * dt); if (d.y >= gy2) { d.y = gy2; d.vy = 0; d.vx = 0; }
    const petR = S.pet ? 220 : 40;
    if (d.t > .35 && Math.abs(d.x - P.x) < petR && Math.abs(d.y - P.y) < 70) { collect(d); d.gone = true; }
    if (d.t > 40) d.gone = true;
  }
  drops = drops.filter(d => !d.gone);
  for (const f of fx) { f.t += dt; if (f.kind === 'meteor' && f.m && !f.done && f.t > .25) { f.done = true; hitMob(f.m, CLASSES.mage.skill.mult); } }
  fx = fx.filter(f => f.t < (f.kind === 'lvup' ? 1.6 : .55));
  for (const t of texts) { t.t += dt; t.y -= 40 * dt; }
  texts = texts.filter(t => t.t < 1.1);
  for (const p of petals) { p.y += p.v * dt; p.x += Math.sin(T + p.r) * 12 * dt - 8 * dt; if (p.y > H + 10) { p.y = -10; p.x = rnd(0, W); } if (p.x < -10) p.x = W + 5; }
  cam = clamp(P.x - W / 2, 0, MAP_W - W);
  const n = nearNpc(), o = nearOre(), pr = $('#prompt');
  const msg = n ? `${n.e} ${n.name}　（按 E／互動）` : o ? `⛏️ ${ORES[o.type].n}　（按 E／互動 挖礦）` : '';
  pr.textContent = msg; pr.classList.toggle('show', !!msg);
  $('#hZone').textContent = zoneAt(P.x).name;
  saveTimer += dt; if (saveTimer > 5) { saveTimer = 0; persist(); }
  hudTick += dt; if (hudTick > .15) { hudTick = 0; updateHud(); }
}
let hudTick = 0;
function collect(d) {
  if (d.kind === 'gold') { S.gold += d.n; addText(P.x, P.y - 80, '+' + d.n + ' 🪙', '#ffe08a'); }
  else { S.inv[d.kind] = (S.inv[d.kind] || 0) + d.n; addText(P.x, P.y - 80, `${ITEMS[d.kind].e} ${ITEMS[d.kind].n}`, '#fff'); }
}
function addText(x, y, s, col, big) { texts.push({ x, y, s: String(s), col, big, t: 0 }); }
function burst(x, y, col, n) { for (let i = 0; i < n; i++) fx.push({ kind: 'spark', x, y, vx: rnd(-160, 160), vy: rnd(-220, -40), col, t: 0 }); }

/* ---------- 繪製 ---------- */
function lerpColor(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = ((pa >> 16) * (1 - t) + (pb >> 16) * t) | 0, gg = (((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t) | 0, bb = ((pa & 255) * (1 - t) + (pb & 255) * t) | 0; return `rgb(${r},${gg},${bb})`; }
function zoneMix(x) { // 平滑過渡天空色
  const i = ZONES.findIndex(z => x >= z.from && x < z.to); const z = ZONES[Math.max(0, i)], nz = ZONES[Math.min(ZONES.length - 1, i + 1)];
  const t = clamp((x - (z.to - 250)) / 250, 0, 1);
  return { top: lerpColor(z.sky[0], nz.sky[0], t), bot: lerpColor(z.sky[1], nz.sky[1], t), hill: lerpColor(z.hill, nz.hill, t), dark: lerpColor(z === ZONES[2] || z === ZONES[3] ? '#ffffff' : '#000000', nz === ZONES[2] || nz === ZONES[3] ? '#ffffff' : '#000000', t) };
}
function tree(g, x, y, s, col) { g.fillStyle = '#8a5a5a'; g.fillRect(x - 4 * s, y - 40 * s, 8 * s, 40 * s); g.fillStyle = col; [[0, -58, 26], [-20, -46, 20], [20, -46, 20], [-10, -70, 18], [12, -68, 18]].forEach(([a, b, r]) => { g.beginPath(); g.arc(x + a * s, y + b * s, r * s, 0, 7); g.fill(); }); }
function house(g, x, y, col, roof, sign) {
  g.fillStyle = col; g.fillRect(x - 70, y - 110, 140, 110); g.fillStyle = roof; g.beginPath(); g.moveTo(x - 86, y - 108); g.lineTo(x, y - 170); g.lineTo(x + 86, y - 108); g.fill();
  g.fillStyle = '#fff6ec'; g.beginPath(); g.roundRect(x - 18, y - 56, 36, 56, [18, 18, 0, 0]); g.fill();
  g.fillStyle = '#ffe9a8'; g.fillRect(x - 54, y - 88, 24, 22); g.fillRect(x + 30, y - 88, 24, 22);
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x - 34, y - 135, 68, 22, 8); g.fill(); g.fillStyle = '#9c4871'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(sign, x, y - 119);
}
function draw() {
  const z = zoneMix(P.x);
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, z.top); sky.addColorStop(1, z.bot); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const zn = zoneAt(P.x);
  if (zn === ZONES[2] || zn === ZONES[3]) { g.fillStyle = 'rgba(255,250,220,.9)'; g.beginPath(); g.arc(780 - cam * .03, 90, 34, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 30; i++) { g.fillRect((i * 137 - cam * .05) % W, (i * 71) % 260, 2, 2); } }
  else { g.fillStyle = 'rgba(255,255,255,.75)'; [[120, 90], [420, 60], [760, 110]].forEach(([x, y]) => { const cx = ((x - cam * .1) % (W + 200) + W + 200) % (W + 200) - 100; g.beginPath(); g.arc(cx, y, 26, 0, 7); g.arc(cx + 28, y + 6, 20, 0, 7); g.arc(cx - 26, y + 8, 18, 0, 7); g.fill(); }); }
  g.fillStyle = z.hill; g.globalAlpha = .55; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, 330 + Math.sin((x + cam * .3) / 140) * 40); g.lineTo(W, H); g.fill(); g.globalAlpha = 1;
  g.save(); g.translate(-cam * .6, 0);
  for (let i = 0; i < 40; i++) { const tx = i * 180 + 60; if (tx < cam * .6 - 120 || tx > cam * .6 + W + 120) continue; const wx = tx / .6; tree(g, tx, GROUND - 6, .9, wx < 2350 ? '#ffc4dc' : wx < 3500 ? '#6a8f8a' : '#5d5590'); }
  g.restore();
  g.save(); g.translate(-cam, 0);
  // 地面
  for (const zz of ZONES) { if (zz.to < cam || zz.from > cam + W) continue; g.fillStyle = zz === ZONES[0] ? '#f3d9c4' : zz === ZONES[1] ? '#9fd89a' : zz === ZONES[2] ? '#5f8a6e' : '#6b6290'; g.fillRect(zz.from, GROUND, zz.to - zz.from, H - GROUND); g.fillStyle = zz === ZONES[0] ? '#e8c3a6' : zz === ZONES[1] ? '#7fc47b' : zz === ZONES[2] ? '#4a735a' : '#4f4775'; g.fillRect(zz.from, GROUND, zz.to - zz.from, 10); }
  if (cam < 1000) { house(g, 220, GROUND, '#fff1e8', '#ff9e7a', '鍛造屋'); house(g, 410, GROUND, '#f3f7ff', '#8fb3ff', '花之商店'); house(g, 600, GROUND, '#f7efff', '#b48cff', '星願召喚殿'); house(g, 790, GROUND, '#fff0f6', '#ff8fb6', '美容院'); g.fillStyle = '#bfe6ff'; g.beginPath(); g.ellipse(80, GROUND - 6, 46, 10, 0, 0, 7); g.fill(); g.fillStyle = '#e9d7c6'; g.fillRect(70, GROUND - 46, 20, 40); g.fillStyle = '#9fd3ff'; g.fillRect(77, GROUND - 60 + Math.sin(T * 3) * 2, 6, 18); }
  g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
  [[950, '→ 花露草原'], [2350, '→ 月影森林'], [3500, '→ 水晶礦洞']].forEach(([x, s]) => { if (x > cam - 100 && x < cam + W + 100) { g.fillStyle = '#8a5a3c'; g.fillRect(x - 3, GROUND - 60, 6, 60); g.fillStyle = '#fff6ec'; g.beginPath(); g.roundRect(x - 52, GROUND - 74, 104, 26, 8); g.fill(); g.fillStyle = '#9c4871'; g.fillText(s, x, GROUND - 56); } });
  for (const p of PLATS) { if (p.x > cam + W || p.x + p.w < cam) continue; g.fillStyle = p.x < 2350 ? '#c79a6b' : '#5c4a6e'; g.beginPath(); g.roundRect(p.x, p.y, p.w, 18, 9); g.fill(); g.fillStyle = p.x < 2350 ? '#9fd89a' : '#7a9a88'; g.beginPath(); g.roundRect(p.x, p.y - 2, p.w, 9, 6); g.fill(); }
  for (const o of ores) {
    if (o.x < cam - 50 || o.x > cam + W + 50) continue; const d = ORES[o.type];
    if (o.dead) { g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(o.x, o.y - 3, 18, 5, 0, 0, 7); g.fill(); continue; }
    g.fillStyle = d.col; g.beginPath(); g.moveTo(o.x - 24, o.y); g.lineTo(o.x - 18, o.y - 26); g.lineTo(o.x - 2, o.y - 36); g.lineTo(o.x + 16, o.y - 28); g.lineTo(o.x + 24, o.y); g.fill();
    g.fillStyle = d.gem; [[-8, -18], [6, -24], [10, -10]].forEach(([a, b]) => { g.beginPath(); g.moveTo(o.x + a, o.y + b - 6); g.lineTo(o.x + a + 4, o.y + b); g.lineTo(o.x + a, o.y + b + 6); g.lineTo(o.x + a - 4, o.y + b); g.fill(); });
    if (o.hp < d.hp) { g.fillStyle = '#0006'; g.fillRect(o.x - 18, o.y - 46, 36, 5); g.fillStyle = '#ffe08a'; g.fillRect(o.x - 18, o.y - 46, 36 * o.hp / d.hp, 5); }
  }
  for (const n of NPCS) { if (n.x < cam - 50 || n.x > cam + W + 50) continue; drawChibi(g, n.x, GROUND, { hair: 'bob', hairColor: n.hair, eyeShape: 'gentle', eye: '#7a4b2e', skin: '#ffe2d0', outfit: n.col, deco: 'blush' }, n.id === 'forge' ? 'knight' : n.id === 'gacha' ? 'mage' : 'priest', { face: -1, blink: Math.sin(T * 2 + n.x) > .97 }); g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(48,38,60,.75)'; const tw = g.measureText(n.name).width + 12; g.beginPath(); g.roundRect(n.x - tw / 2, GROUND + 6, tw, 17, 8); g.fill(); g.fillStyle = '#ffe08a'; g.fillText(n.name, n.x, GROUND + 19); }
  for (const d of drops) { const yy = d.y - 8 + Math.sin(d.t * 5) * 2; if (d.kind === 'gold') { g.fillStyle = '#ffcf4a'; g.beginPath(); g.arc(d.x, yy, 7, 0, 7); g.fill(); g.fillStyle = '#fff2a8'; g.beginPath(); g.arc(d.x - 2, yy - 2, 2.5, 0, 7); g.fill(); } else { g.font = '18px sans-serif'; g.textAlign = 'center'; g.fillText(ITEMS[d.kind].e, d.x, yy + 6); } }
  for (const m of mobs) { if (m.dead || m.x < cam - 80 || m.x > cam + W + 80) continue; drawMob(m); }
  if (S.pet) { const px = P.x - P.face * 36; drawPet(g, S.pet, (S._petX = S._petX == null ? px : S._petX + (px - S._petX) * .08), P.y, T); }
  const flick = P.inv > 0 && Math.floor(T * 20) % 2;
  if (!flick) {
    if (S.riding && S.mount) { drawMount(g, P.x, P.y, P.face, P.vx ? T : 0); drawChibi(g, P.x - P.face * 2, P.y - 22, S.look, S.cls, { face: P.face, atk: P.atkT, blink: P.blinkT < 0 }); }
    else drawChibi(g, P.x, P.y, S.look, S.cls, { face: P.face, walk: P.vx && P.onG ? P.walk : 0, atk: P.atkT, blink: P.blinkT < 0 });
  }
  g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; const nw = g.measureText(S.name).width + 14; g.fillStyle = 'rgba(48,38,60,.8)'; g.beginPath(); g.roundRect(P.x - nw / 2, P.y + 6, nw, 18, 9); g.fill(); g.fillStyle = '#fff'; g.fillText(S.name, P.x, P.y + 19);
  for (const p of projs) drawProj(p);
  for (const f of fx) drawFx(f);
  for (const t of texts) { g.globalAlpha = 1 - Math.max(0, t.t - .6) * 2; g.font = `900 ${t.big ? 26 : 20}px sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(60,20,40,.75)'; g.strokeText(t.s, t.x, t.y); g.fillStyle = t.col; g.fillText(t.s, t.x, t.y); g.globalAlpha = 1; }
  g.restore();
  g.fillStyle = 'rgba(255,190,215,.85)';
  if (zn !== ZONES[3]) for (const p of petals) { g.save(); g.translate(p.x, p.y); g.rotate(T * p.s + p.r); g.beginPath(); g.ellipse(0, 0, 5 * p.s, 3 * p.s, 0, 0, 7); g.fill(); g.restore(); }
}
function drawMob(m) {
  const d = m.d, x = m.x, y = m.y, f = m.vx > 0 ? 1 : -1;
  g.save(); g.translate(x, y);
  if (m.hitT > 0) g.filter = 'brightness(1.8)';
  g.fillStyle = 'rgba(0,0,0,.12)'; if (!d.fly) { g.beginPath(); g.ellipse(0, 0, d.w / 2, 5, 0, 0, 7); g.fill(); }
  if (m.type === 'slime') { const sq = Math.sin(m.t * 6) * 3; g.fillStyle = d.col; g.beginPath(); g.ellipse(0, -16 + sq * .3, 21 + sq, 17 - sq, 0, Math.PI, 0); g.lineTo(21 + sq, 0); g.lineTo(-21 - sq, 0); g.fill(); g.fillStyle = '#fff8'; g.beginPath(); g.ellipse(-8, -24, 5, 3, -.4, 0, 7); g.fill(); g.fillStyle = '#ff6b9a'; g.beginPath(); g.arc(0, -36 + sq * .3, 4, 0, 7); g.fill(); eyes(-6 * f + f * 4, -16, f); }
  if (m.type === 'bfly') { const fl = Math.abs(Math.sin(m.t * 14)); g.fillStyle = d.col; g.globalAlpha = .9; g.beginPath(); g.ellipse(-12, -18, 14 * fl + 3, 12, -.5, 0, 7); g.ellipse(12, -18, 14 * fl + 3, 12, .5, 0, 7); g.fill(); g.fillStyle = '#ffe6ff'; g.beginPath(); g.ellipse(-10, -8, 8 * fl + 2, 7, -.3, 0, 7); g.ellipse(10, -8, 8 * fl + 2, 7, .3, 0, 7); g.fill(); g.globalAlpha = 1; g.fillStyle = '#4a3a6a'; g.beginPath(); g.ellipse(0, -14, 4, 12, 0, 0, 7); g.fill(); g.strokeStyle = '#4a3a6a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-1, -25); g.lineTo(-6, -34); g.moveTo(1, -25); g.lineTo(6, -34); g.stroke(); }
  if (m.type === 'sprite') { const b = Math.sin(m.t * 5) * 2; g.fillStyle = '#5aa874'; g.beginPath(); g.ellipse(-10, -44 + b, 6, 12, -.6, 0, 7); g.ellipse(10, -44 + b, 6, 12, .6, 0, 7); g.fill(); g.fillStyle = d.col; g.beginPath(); g.arc(0, -24 + b, 18, 0, 7); g.fill(); g.fillStyle = '#5aa874'; g.fillRect(-9, -8 + b, 6, 8); g.fillRect(3, -8 + b, 6, 8); eyes(3 * f, -26 + b, f); }
  if (m.type === 'golem') { g.fillStyle = '#7f78b8'; g.beginPath(); g.roundRect(-28, -54, 56, 46, 12); g.fill(); g.fillStyle = d.col; [[-14, -60], [10, -64], [22, -50]].forEach(([a, b]) => { g.beginPath(); g.moveTo(a, b - 10); g.lineTo(a + 6, b); g.lineTo(a, b + 10); g.lineTo(a - 6, b); g.fill(); }); g.fillStyle = '#5d5590'; g.fillRect(-24, -10, 16, 10); g.fillRect(8, -10, 16, 10); g.fillStyle = '#bfe6ff'; g.beginPath(); g.arc(-8 + f * 4, -34, 4, 0, 7); g.arc(8 + f * 4, -34, 4, 0, 7); g.fill(); }
  g.filter = 'none'; g.restore();
  if (m.hp < d.hp) { const bw = Math.max(36, d.w); g.fillStyle = '#0007'; g.fillRect(x - bw / 2, y - d.h - 16, bw, 5); g.fillStyle = '#ff5c8a'; g.fillRect(x - bw / 2, y - d.h - 16, bw * Math.max(0, m.hp) / d.hp, 5); }
  if (m.aggro > 0 || Math.abs(m.x - P.x) < 160) { g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#0006'; g.lineWidth = 3; const s = `Lv.${d.lv} ${d.name}`; g.strokeText(s, x, y + 16); g.fillText(s, x, y + 16); }
}
function eyes(x, y, f) { g.fillStyle = '#2a1f2a'; g.beginPath(); g.ellipse(x - 5, y, 2.4, 3.4, 0, 0, 7); g.ellipse(x + 5, y, 2.4, 3.4, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 5.6, y - 1.2, .9, 0, 7); g.arc(x + 4.4, y - 1.2, .9, 0, 7); g.fill(); }
function drawProj(p) {
  g.save(); g.translate(p.x, p.y);
  if (p.kind === 'star') { g.rotate(T * 12); g.fillStyle = '#ffe58a'; star(g, 0, 0, 9, 4); }
  else if (p.kind === 'arrow') { g.scale(Math.sign(p.vx), 1); g.fillStyle = '#8a5a3c'; g.fillRect(-14, -1, 24, 2.5); g.fillStyle = '#e9eef7'; g.beginPath(); g.moveTo(14, 0); g.lineTo(8, -4); g.lineTo(8, 5); g.fill(); g.fillStyle = '#ff9ec4'; g.fillRect(-16, -3, 5, 7); }
  else { g.scale(Math.sign(p.vx), 1); const gr = g.createLinearGradient(-40, 0, 14, 0); gr.addColorStop(0, 'rgba(180,200,255,0)'); gr.addColorStop(1, '#e6eeff'); g.fillStyle = gr; g.beginPath(); g.moveTo(-40, -3); g.lineTo(14, 0); g.lineTo(-40, 3); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(12, 0, 4, -1.2, 1.2); g.fill(); }
  g.restore();
}
function drawFx(f) {
  const t = f.t;
  if (t < 0) return;
  if (f.kind === 'spark') { g.globalAlpha = 1 - t * 2; g.fillStyle = f.col; g.beginPath(); g.arc(f.x + f.vx * t, f.y + f.vy * t + 300 * t * t, 3.2, 0, 7); g.fill(); g.globalAlpha = 1; }
  if (f.kind === 'slash') { g.save(); g.translate(f.x, f.y); g.scale(f.f, 1); g.globalAlpha = 1 - t * 2; g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(-10, 0, 30, -1.2 + t * 2, .9 + t * 2); g.stroke(); g.restore(); g.globalAlpha = 1; }
  if (f.kind === 'rose') { g.save(); g.translate(f.x, f.y); g.globalAlpha = 1 - t * 1.8; for (let i = 0; i < 8; i++) { const a = i * .8 + t * 6; g.fillStyle = i % 2 ? '#ff6b9a' : '#ffc1d8'; g.beginPath(); g.ellipse(Math.cos(a) * 60 * t * 2 * f.f, Math.sin(a) * 26, 9, 5, a, 0, 7); g.fill(); } g.restore(); g.globalAlpha = 1; }
  if (f.kind === 'meteor') { const k = Math.min(1, t / .25); g.globalAlpha = 1 - Math.max(0, t - .3) * 3; g.fillStyle = '#ffe58a'; star(g, f.x - 80 * (1 - k), f.y - 160 * (1 - k), 12, 5); if (k >= 1) { g.fillStyle = 'rgba(255,200,240,.6)'; g.beginPath(); g.arc(f.x, f.y, 30 * (t - .2) * 4, 0, 7); g.fill(); } g.globalAlpha = 1; }
  if (f.kind === 'bloom') { g.globalAlpha = 1 - t * 1.8; for (let i = 0; i < 10; i++) { const a = i * .628; g.fillStyle = i % 2 ? '#7ee08f' : '#ffc1d8'; g.beginPath(); g.arc(f.x + Math.cos(a) * 110 * t * 1.8, f.y - 30 + Math.sin(a) * 40 * t * 1.8, 6, 0, 7); g.fill(); } g.globalAlpha = 1; }
  if (f.kind === 'lvup') { g.globalAlpha = 1 - Math.max(0, t - 1) * 1.6; g.strokeStyle = '#ffe58a'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(P.x, P.y - 4, 30 + i * 10 + t * 20, 8 + i * 3, 0, 0, 7); g.stroke(); } g.font = '900 28px sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#9c4871'; g.strokeText('LEVEL UP!', P.x, P.y - 110 - t * 20); g.fillStyle = '#ffe58a'; g.fillText('LEVEL UP!', P.x, P.y - 110 - t * 20); g.globalAlpha = 1; }
}

/* ---------- HUD ---------- */
const fg = $('#face').getContext('2d');
function refreshFace() { fg.clearRect(0, 0, 56, 56); drawChibi(fg, 28, 104, S.look, S.cls, { scale: 1.45 }); }
function updateHud() {
  if (!S) return; const st = stats();
  $('#hName').textContent = S.name; $('#hLv').textContent = 'Lv.' + S.lv; $('#hCls').textContent = CLASSES[S.cls].name;
  $('#bHp').style.width = (100 * S.hp / st.maxHp) + '%'; $('#tHp').textContent = `HP ${Math.ceil(S.hp)}/${st.maxHp}`;
  $('#bMp').style.width = (100 * S.mp / st.maxMp) + '%'; $('#tMp').textContent = `MP ${Math.ceil(S.mp)}/${st.maxMp}`;
  $('#bExp').style.width = (100 * S.exp / expNeed(S.lv)) + '%'; $('#tExp').textContent = `EXP ${S.exp}/${expNeed(S.lv)}（${(100 * S.exp / expNeed(S.lv)).toFixed(1)}%）`;
  $('#hGold').textContent = S.gold.toLocaleString(); $('#nHp').textContent = S.inv.hpPot; $('#nMp').textContent = S.inv.mpPot;
}
let toastT;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- 面板 ---------- */
function openPanel(title, html, bind) { $('#panelT').textContent = title; $('#panelB').innerHTML = html; $('#panel').hidden = false; Object.keys(keys).forEach(k => keys[k] = false); if (bind) bind($('#panelB')); }
function closePanel() { $('#panel').hidden = true; persist(); updateHud(); }
$('#panelX').onclick = closePanel; $('#panel').addEventListener('click', e => { if (e.target.id === 'panel') closePanel(); });
function openBag() {
  const st = stats();
  const cells = Object.entries(ITEMS).map(([k, it]) => `<div class="cell"><span class="e">${it.e}</span>${it.n}<b>${S.inv[k] || 0}</b></div>`).join('');
  const pets = S.pets.length ? S.pets.map(p => `<button class="btn sm" data-pet="${p}">${PETS[p].e} ${PETS[p].n}${S.pet === p ? '（出戰中）' : ''}</button>`).join(' ') : '<span class="note">還沒有寵物，去星願召喚殿抽抽看！</span>';
  const mounts = S.mounts.length ? S.mounts.map(m => `<button class="btn sm" data-mount="${m}">${MOUNTS[m].e} ${MOUNTS[m].n}${S.riding && S.mount === m ? '（騎乘中）' : ''}</button>`).join(' ') : '<span class="note">還沒有坐騎（SSR 獎勵）</span>';
  openPanel('🎒 背包', `<p class="note">${CLASSES[S.cls].name}・攻擊力 ${st.atk}・武器 +${S.weaponLv}・十字鎬 Lv.${S.pickLv}・🪙 ${S.gold}・擊敗怪物 ${S.kills}</p><div class="grid">${cells}</div><h3 style="margin-top:16px;font-size:16px">🐾 寵物（會幫你撿東西）</h3><div>${pets}</div><h3 style="margin-top:16px;font-size:16px">🦌 坐騎</h3><div>${mounts}</div>`, b => {
    b.querySelectorAll('[data-pet]').forEach(x => x.onclick = () => { S.pet = S.pet === x.dataset.pet ? null : x.dataset.pet; S._petX = null; openBag(); });
    b.querySelectorAll('[data-mount]').forEach(x => x.onclick = () => { S.mount = x.dataset.mount; S.riding = !S.riding; openBag(); });
  });
}
function openNpc(id) {
  if (id === 'forge') return openForge();
  if (id === 'shop') return openShop();
  if (id === 'gacha') return openGacha();
  if (id === 'salon') { openCreate(true); }
}
function canPay(cost) { return Object.entries(cost).every(([k, v]) => (k === 'gold' ? S.gold : S.inv[k] || 0) >= v); }
function pay(cost) { Object.entries(cost).forEach(([k, v]) => { if (k === 'gold') S.gold -= v; else S.inv[k] -= v; }); }
const costText = c => Object.entries(c).filter(([, v]) => v > 0).map(([k, v]) => k === 'gold' ? `🪙${v}` : `${ITEMS[k].e}${v}`).join('　');
function openForge() {
  const wl = S.weaponLv, pl = S.pickLv;
  const wCost = { gold: 40 + wl * 40, iron: 3 + wl * 2, crystal: wl >= 3 ? wl - 1 : 0, star: wl >= 6 ? wl - 4 : 0, dew: wl < 3 ? 2 : 0, leaf: wl >= 4 ? 2 : 0 };
  const pCost = { gold: 60 * pl, iron: 4 * pl, crystal: pl >= 2 ? (pl - 1) * 2 : 0, star: pl >= 4 ? pl - 2 : 0 };
  const potCost = { dew: 3, gold: 5 };
  openPanel('⚒️ 鍛造屋・蘿絲', `<div class="list">
    <div class="item"><div><b>強化武器 +${wl} → +${wl + 1}</b><p>攻擊力 +5</p><span class="cost">${costText(wCost)}</span></div><button class="btn sm pri" data-f="w" ${canPay(wCost) ? '' : 'disabled'}>鍛造</button></div>
    <div class="item"><div><b>升級十字鎬 Lv.${pl} → Lv.${pl + 1}</b><p>挖礦更快，更容易多挖到礦</p><span class="cost">${costText(pCost)}</span></div><button class="btn sm pri" data-f="p" ${canPay(pCost) ? '' : 'disabled'}>鍛造</button></div>
    <div class="item"><div><b>調製紅藥水 x2</b><p>用花露調配</p><span class="cost">${costText(potCost)}</span></div><button class="btn sm" data-f="pot" ${canPay(potCost) ? '' : 'disabled'}>調製</button></div>
  </div><p class="note">打怪掉落素材、挖礦取得礦石，就能來找我強化裝備喔！</p>`, b => {
    b.querySelector('[data-f=w]').onclick = () => { pay(wCost); S.weaponLv++; toast(`⚔️ 武器強化成功！+${S.weaponLv}`); persist(); openForge(); };
    b.querySelector('[data-f=p]').onclick = () => { pay(pCost); S.pickLv++; toast(`⛏️ 十字鎬升級！Lv.${S.pickLv}`); persist(); openForge(); };
    b.querySelector('[data-f=pot]').onclick = () => { pay(potCost); S.inv.hpPot += 2; persist(); openForge(); };
  });
}
function openShop() {
  const sellable = ['iron', 'crystal', 'star', 'dew', 'dust', 'leaf'];
  const total = sellable.reduce((s, k) => s + (S.inv[k] || 0) * ITEMS[k].sell, 0);
  openPanel('🛍️ 花之商店・米米', `<div class="list">
    <div class="item"><div><b>❤️ 紅藥水</b><p>回復 50% HP</p><span class="cost">🪙20</span></div><div class="row" style="margin:0"><button class="btn sm" data-b="hpPot,1">買 1</button><button class="btn sm" data-b="hpPot,10">買 10</button></div></div>
    <div class="item"><div><b>🔷 藍藥水</b><p>回復 60% MP</p><span class="cost">🪙25</span></div><div class="row" style="margin:0"><button class="btn sm" data-b="mpPot,1">買 1</button><button class="btn sm" data-b="mpPot,10">買 10</button></div></div>
    <div class="item"><div><b>🎫 召喚券</b><p>星願召喚殿使用</p><span class="cost">🪙300</span></div><button class="btn sm" data-b="ticket,1">買 1</button></div>
    <div class="item"><div><b>賣出素材（花露、鱗粉、精靈葉）</b><p>礦石建議留著鍛造</p></div><button class="btn sm pri" data-sell="mat">賣出</button></div>
    <div class="item"><div><b>全部賣出（含礦石）</b><p>可得 🪙${total}</p></div><button class="btn sm" data-sell="all">全部賣</button></div>
  </div>`, b => {
    const price = { hpPot: 20, mpPot: 25, ticket: 300 };
    b.querySelectorAll('[data-b]').forEach(x => x.onclick = () => { const [k, n] = x.dataset.b.split(','); const c = price[k] * n; if (S.gold < c) { toast('金幣不夠喔'); return; } S.gold -= c; S.inv[k] += +n; toast(`買了 ${ITEMS[k].n} x${n}`); persist(); updateHud(); openShop(); });
    b.querySelectorAll('[data-sell]').forEach(x => x.onclick = () => { const ks = x.dataset.sell === 'all' ? sellable : ['dew', 'dust', 'leaf']; let got = 0; ks.forEach(k => { got += (S.inv[k] || 0) * ITEMS[k].sell; S.inv[k] = 0; }); S.gold += got; toast(`賣出獲得 🪙${got}`); persist(); updateHud(); openShop(); });
  });
}
const GACHA = [
  { r: 'SSR', p: .02 }, { r: 'SR', p: .13 }, { r: 'R', p: .35 }, { r: 'N', p: .50 }
];
function rollGacha() {
  let x = Math.random(), r = 'N';
  for (const g2 of GACHA) { if (x < g2.p) { r = g2.r; break; } x -= g2.p; }
  if (r === 'SSR') { if (!S.mounts.includes('deer')) { S.mounts.push('deer'); S.mount = 'deer'; return { r, e: '🦌', t: '坐騎「櫻花鹿」', s: '在背包點選就能騎乘，移動速度 +45%' }; } S.gold += 1500; return { r, e: '🪙', t: '金幣 1500', s: '已擁有櫻花鹿，轉換成金幣' }; }
  if (r === 'SR') { const id = pick(Object.keys(PETS)); if (!S.pets.includes(id)) { S.pets.push(id); if (!S.pet) S.pet = id; return { r, e: PETS[id].e, t: `寵物「${PETS[id].n}」`, s: '寵物會跟著你，還會幫你撿掉落物' }; } S.gold += 300; return { r, e: '🪙', t: '金幣 300', s: `已擁有${PETS[id].n}，轉換成金幣` }; }
  if (r === 'R') { const locked = OUTFITS.map((_, i) => i).filter(i => !S.outfits.includes(i)); if (locked.length) { const i = pick(locked); S.outfits.push(i); return { r, e: '👗', t: '新服裝顏色', s: '到美容院就能換上', col: OUTFITS[i] }; } S.inv.hpPot += 5; return { r, e: '❤️', t: '紅藥水 x5', s: '' }; }
  const n = pick([{ e: '❤️', t: '紅藥水 x3', f: () => S.inv.hpPot += 3 }, { e: '🔷', t: '藍藥水 x3', f: () => S.inv.mpPot += 3 }, { e: '🪙', t: '金幣 80', f: () => S.gold += 80 }, { e: '🪨', t: '鐵礦 x4', f: () => S.inv.iron += 4 }]); n.f(); return { r, e: n.e, t: n.t, s: '' };
}
function openGacha(res) {
  const show = res ? res.map(x => `<div class="gacha-show ${x.r}"><div class="e">${x.e}</div><b>${x.r}・${x.t}</b>${x.col ? `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${x.col};vertical-align:middle;margin-left:6px;border:1px solid #ddd"></span>` : ''}<p class="note">${x.s}</p></div>`).join('') : '';
  openPanel('✨ 星願召喚殿', `<p class="note">用 🎫 召喚券抽取寵物、坐騎、服裝和道具。召喚券可以靠升級、打怪掉落或商店購買取得（遊戲內金幣）。</p>
    <div class="rates"><span>SSR 2%・坐騎</span><span>SR 13%・寵物</span><span>R 35%・服裝</span><span>N 50%・道具</span></div>
    <div class="row" style="justify-content:flex-start"><button class="btn pri" data-g="1" ${S.inv.ticket >= 1 ? '' : 'disabled'}>召喚 1 次（🎫1）</button><button class="btn" data-g="10" ${S.inv.ticket >= 10 ? '' : 'disabled'}>召喚 10 次（🎫10）</button><span class="note" style="align-self:center">擁有 🎫 ${S.inv.ticket}</span></div>${show}`, b => {
    b.querySelectorAll('[data-g]').forEach(x => x.onclick = () => { const n = +x.dataset.g; if (S.inv.ticket < n) return; S.inv.ticket -= n; const out = Array.from({ length: n }, rollGacha); out.sort((a, c) => 'SSR SR R N'.split(' ').indexOf(a.r) - 'SSR SR R N'.split(' ').indexOf(c.r)); persist(); openGacha(out.slice(0, n === 1 ? 1 : 10)); });
  });
}
function openMenu() {
  openPanel('☰ 選單', `<div class="list menu-list">
    <button class="btn" data-m="bag">🎒 背包・寵物・坐騎</button>
    <button class="btn" data-m="town">🏰 回到櫻華王都</button>
    <button class="btn" data-m="help">❓ 操作說明</button>
    <button class="btn" data-m="road">🗺️ 開發進度</button>
    <a class="btn" href="play.html">← 存檔並回到花花遊戲區</a>
  </div><p class="note">v0.1 單人試玩版：進度存在這台裝置的瀏覽器。之後會改成雲端存檔，換裝置也能繼續玩。</p>`, b => {
    b.querySelector('[data-m=bag]').onclick = openBag;
    b.querySelector('[data-m=town]').onclick = () => { P.x = 120; P.y = GROUND; auto = false; $('#qAuto').classList.remove('on'); closePanel(); };
    b.querySelector('[data-m=help]').onclick = () => openPanel('❓ 操作說明', `<div class="list"><div class="item"><div><b>電腦</b><p>←→／A D 移動・Space／↑ 跳躍・↓＋跳躍 跳下平台・J 攻擊・K 技能・E 與 NPC 對話／挖礦・Q 自動打怪・1 紅藥水・2 藍藥水・I 背包</p></div></div><div class="item"><div><b>手機</b><p>左下 ◀ ▶ 移動，右下「攻擊／技能／跳／互動」，右上快捷鍵可喝藥、開背包和自動打怪。建議橫向遊玩。</p></div></div><div class="item"><div><b>自動打怪</b><p>開啟後角色會自己找最近的怪物、移動、攻擊、放技能，血量低於 40% 會自動喝紅藥水。</p></div></div></div>`);
    b.querySelector('[data-m=road]').onclick = () => openPanel('🗺️ 開發進度', `<div class="list">
      <div class="item"><div><b>✅ v0.1（現在）</b><p>捏臉創角、4 大職業、橫向地圖、打怪、自動打怪、挖礦、鍛造、商店、抽卡、寵物、坐騎、存檔</p></div></div>
      <div class="item"><div><b>🔜 v0.2</b><p>雲端存檔（綁定會員帳號）、更多髮型與服裝、任務系統</p></div></div>
      <div class="item"><div><b>🔜 v0.3</b><p>多人連線：同地圖看見其他玩家、公開聊天、一起聽歌的音樂廳</p></div></div>
      <div class="item"><div><b>🔜 之後</b><p>好友、組隊、情侶與結婚、夫妻家園與家具裝飾、時裝商城、更多寵物與坐騎</p></div></div></div>`);
  });
}

/* ---------- 主迴圈 ---------- */
function resize() {
  const vw = innerWidth, vh = innerHeight, touch = matchMedia('(pointer:coarse)').matches;
  // 手機橫向：填滿畫面（只裁切天空）；其他：完整顯示
  const sc = touch && vw > vh ? Math.max(vw / W, vh / H) : Math.min(vw / W, vh / H);
  const cw = Math.round(W * sc), ch = Math.round(H * sc);
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.style.top = (ch > vh ? vh - ch : Math.round((vh - ch) / 2)) + 'px';
}
addEventListener('resize', resize);
function loop(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (running && $('#panel').hidden && S && P) { update(dt); draw(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
addEventListener('pagehide', persist);
})();
