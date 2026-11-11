// The game always draws on a wide "stage". On an upright phone the stage is turned 90°, so pointer
// positions and sizes go through here instead of innerWidth / clientX.
const Stage = {
  rot: false, w: 1280, h: 720,
  update() {
    const W = innerWidth, H = innerHeight; this.rot = H > W * 1.02; this.w = this.rot ? H : W; this.h = this.rot ? W : H;
    const b = document.body; if (!b) return; b.classList.toggle('rot', this.rot);
    b.style.width = this.rot ? H + 'px' : ''; b.style.height = this.rot ? W + 'px' : ''; b.style.left = this.rot ? W + 'px' : '';
  },
  x(e) { return this.rot ? e.clientY : e.clientX; },
  y(e) { return this.rot ? innerWidth - e.clientX : e.clientY; },
  rect(el) { const r = el.getBoundingClientRect(); return this.rot ? { left: r.top, right: r.bottom, top: innerWidth - r.right, bottom: innerWidth - r.left } : r; },
};
// ================================================================
// MALANG RACE — core utilities, save data, sound
// ================================================================
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const FONT = "'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'WenQuanYi Zen Hei', sans-serif";

// ---------------- Save data (local, versioned; server sync can replace backend later) -------------
const SAVE_KEY = 'malangrace.save.v1';
const Save = {
  data: null,
  defaults() {
    return {
      version: 2, lastCrown: null,
      profile: null, // { nick, age, level, createdAt }
      xp: 0,
      energy: 0,
      energyEarned: 0,
      stats: { byType: {}, total: { a: 0, c: 0 }, stomps: 0, races: 0, wins: 0 },
      wrongNotes: [],
      history: [],
      owned: ['color:pink', 'color:sky', 'color:lemon', 'pattern:none', 'hat:none', 'glasses:none', 'outfit:none', 'wings:none', 'bag:none', 'shoes:none', 'face:normal', 'face:happy', 'trail:none', 'costume:none'],
      equip: { color: 'pink', pattern: 'none', hat: 'none', glasses: 'none', outfit: 'none', wings: 'none', bag: 'none', shoes: 'none', face: 'normal', trail: 'none', costume: 'none' },
      unlockedWorlds: ['candy'], worldBest: {}, runTickets: 0, runProgress: 0,
      settings: { sound: true, music: true, quality: 'auto', racers: 50 },
      daily: { date: '', progress: {}, claimed: {} },
      attendance: { last: '', streak: 0, days: 0 },
      promo: { attempts: 0, history: [] },
      bestCombo: 0,
    };
  },
  key: SAVE_KEY,
  read(key) { try { const raw = localStorage.getItem(key || this.key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
  load() { return this.use(this.read(this.key)); },
  use(d) {
    const def = this.defaults();
    if (!d || typeof d !== 'object') d = def;
    if (d.version === 1) { if (d.profile) d.profile.level = { 1: 1, 2: 3, 3: 4, 4: 6 }[d.profile.level] || 1; d.version = 2; }
    for (const k in def) if (d[k] === undefined) d[k] = def[k];
    for (const k in def.settings) if (d.settings[k] === undefined) d.settings[k] = def.settings[k];
    for (const k in def.equip) if (d.equip[k] === undefined) d.equip[k] = def.equip[k];
    for (const k in def.stats) if (d.stats[k] === undefined) d.stats[k] = def.stats[k];
    this.data = d;
    return d;
  },
  save(quiet) { this.data._ts = Date.now(); try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* storage unavailable: keep in memory */ } try { Online.onSave(quiet); } catch (e) {} },
  reset() { try { localStorage.removeItem(this.key); } catch (e) {} this.data = this.defaults(); },
};

// player account level from XP (separate from math level)
function accountLevel(xp) { let lv = 1, need = 100, x = xp; while (x >= need) { x -= need; lv++; need = Math.round(need * 1.25); } return { lv, cur: x, need }; }

// ---------------- Sound (WebAudio synth; no external assets) ----------------
const Sound = {
  ctx: null, master: null, sfx: null, mus: null, musicTimer: null, musicOn: false, nextNote: 0, step: 0, theme: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
      this.mus = this.ctx.createGain(); this.mus.gain.value = 0.16; this.mus.connect(this.master);
      this.applySettings();
    } catch (e) { this.ctx = null; }
  },
  applySettings() {
    if (!this.ctx) return; const s = Save.data.settings;
    this.sfx.gain.value = s.sound ? 0.55 : 0; this.mus.gain.value = s.music ? 0.16 : 0;
  },
  tone(freq, dur, type = 'sine', vol = 0.4, slideTo = null, when = 0, dest = null) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.2, freq = 800, when = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + when;
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t);
  },
  play(name) {
    if (!this.ctx || !Save.data.settings.sound) return;
    switch (name) {
      case 'jump': this.tone(320, 0.16, 'sine', 0.25, 720); break;
      case 'land': this.tone(160, 0.1, 'sine', 0.22, 90); break;
      case 'stomp': this.tone(520, 0.22, 'triangle', 0.35, 110); this.noise(0.12, 0.15, 1200); this.tone(900, 0.08, 'sine', 0.15, 1400, 0.12); break;
      case 'squished': this.tone(260, 0.25, 'triangle', 0.22, 80); break;
      case 'boing': this.tone(200, 0.25, 'sine', 0.3, 600); this.tone(600, 0.2, 'sine', 0.12, 300, 0.08); break;
      case 'pad': this.tone(220, 0.35, 'square', 0.12, 1300); this.noise(0.25, 0.1, 3000); break;
      case 'hit': this.noise(0.15, 0.3, 500); this.tone(140, 0.15, 'sawtooth', 0.12, 70); break;
      case 'correct': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.25, null, i * 0.07)); break;
      case 'wrong': this.tone(220, 0.14, 'square', 0.14, 180); this.tone(170, 0.22, 'square', 0.14, 120, 0.13); break;
      case 'shield': this.tone(900, 0.3, 'sine', 0.12, 400); break;
      case 'count': this.tone(660, 0.15, 'sine', 0.3); break;
      case 'go': this.tone(990, 0.35, 'sine', 0.3); this.tone(1320, 0.35, 'sine', 0.15); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.2, 'square', 0.1, null, 0.07); break;
      case 'click': this.tone(700, 0.06, 'sine', 0.18, 900); break;
      case 'finish': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.22, null, i * 0.11)); break;
      case 'fall': this.tone(600, 0.6, 'sine', 0.18, 120); break;
      case 'crumble': this.noise(0.3, 0.2, 300); break;
      case 'zap': this.tone(1400, 0.15, 'sawtooth', 0.1, 300); break;
    }
  },
  // gentle procedural loop per world
  startMusic(theme) {
    if (!this.ctx) return; this.stopMusic(); this.theme = theme; this.musicOn = true; this.step = 0; this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 60);
  },
  stopMusic() { this.musicOn = false; if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null; },
  schedule() {
    if (!this.ctx || !this.musicOn) return; const th = this.theme || MUSIC.hub; const spb = 60 / th.bpm / 2;
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      const s = this.step, when = this.nextNote - this.ctx.currentTime;
      const bar = Math.floor(s / 8) % th.prog.length, root = th.root * Math.pow(2, th.prog[bar] / 12);
      if (s % 8 === 0) this.tone(root / 2, spb * 3.5, th.bass, 0.5, null, when, this.mus);
      if (s % 8 === 4) this.tone(root / 2 * 1.5, spb * 2, th.bass, 0.35, null, when, this.mus);
      const mel = th.mel[s % th.mel.length];
      if (mel !== null) this.tone(root * Math.pow(2, mel / 12), spb * 1.6, th.lead, 0.28, null, when, this.mus);
      if (s % 2 === 1) this.tone(root * 2 * Math.pow(2, th.chord[(s >> 1) % 3] / 12), spb * 0.6, 'sine', 0.12, null, when, this.mus);
      this.nextNote += spb; this.step++;
    }
  },
};
const MUSIC = {
  hub: { bpm: 104, root: 392, prog: [0, 5, -3, 7], bass: 'triangle', lead: 'sine', chord: [0, 4, 7], mel: [0, null, 4, 7, null, 9, 7, null, 4, null, 2, 4, null, 0, null, null] },
  candy: { bpm: 132, root: 440, prog: [0, -4, 5, 7], bass: 'triangle', lead: 'triangle', chord: [0, 4, 7], mel: [0, 4, 7, 12, 7, 4, 9, null, 7, 4, 2, 4, 0, null, 2, null] },
  block: { bpm: 124, root: 392, prog: [0, 3, 5, 3], bass: 'square', lead: 'square', chord: [0, 3, 7], mel: [0, null, 7, null, 5, 3, 0, null, 3, 5, 7, 10, 7, null, 5, null] },
  cloud: { bpm: 112, root: 523, prog: [0, 5, 7, 5], bass: 'sine', lead: 'sine', chord: [0, 4, 9], mel: [7, null, 4, null, 2, null, 4, 7, 9, null, 7, null, 4, 2, 0, null] },
  jungle: { bpm: 120, root: 349, prog: [0, 5, 3, 7], bass: 'triangle', lead: 'square', chord: [0, 4, 7], mel: [0, 4, 7, null, 9, 7, 4, null, 5, 9, 12, null, 9, 7, 4, null] },
  space: { bpm: 116, root: 415, prog: [0, -5, 3, -2], bass: 'sine', lead: 'sawtooth', chord: [0, 3, 10], mel: [12, null, 7, null, 10, null, 3, 7, 12, null, 15, null, 10, 7, 3, null] },
  crystal: { bpm: 128, root: 466, prog: [0, -2, -4, -5], bass: 'triangle', lead: 'sawtooth', chord: [0, 3, 7], mel: [12, 7, 3, 7, 12, 15, 14, 12, 10, 7, 3, null, 7, 10, 12, null] },
};
