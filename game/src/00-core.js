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
// course building draws from RNG so friend rooms can rebuild the exact same course from a seed
let RNG = Math.random;
const rand = (a, b) => a + RNG() * (b - a);
const randi = (a, b) => Math.floor(a + RNG() * (b - a + 1));
const pick = (arr) => arr[Math.floor(RNG() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(RNG() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
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
      this.mus = this.ctx.createGain(); this.mus.gain.value = 0.2; this.mus.connect(this.master);
      this.applySettings();
    } catch (e) { this.ctx = null; }
  },
  applySettings() {
    if (!this.ctx) return; const s = Save.data.settings;
    this.sfx.gain.value = s.sound ? 0.55 : 0; this.mus.gain.value = s.music ? 0.2 : 0;
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
  play(name, vol) {
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
      case 'star': this.tone(1568, 0.07, 'triangle', 0.16 * (vol || 1)); this.tone(2093, 0.09, 'triangle', 0.14 * (vol || 1), null, 0.06); this.tone(2637, 0.22, 'sine', 0.12 * (vol || 1), null, 0.12); break;
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
  // drums for the music bus (synthesised, no files)
  drum(kind, when, vol = 1) {
    const c = this.ctx, t = c.currentTime + when;
    if (kind === 'kick') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 0.3); return; }
    const dur = kind === 'hat' ? 0.05 : kind === 'open' ? 0.18 : 0.16;
    if (!this._nb) { const len = c.sampleRate * 0.4; this._nb = c.createBuffer(1, len, c.sampleRate); const d = this._nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
    const src = c.createBufferSource(); src.buffer = this._nb; const f = c.createBiquadFilter(), g = c.createGain();
    if (kind === 'snare' || kind === 'clap') { f.type = 'bandpass'; f.frequency.value = kind === 'clap' ? 1400 : 1900; f.Q.value = 0.7; this.tone(190, 0.1, 'triangle', 0.35 * vol, 120, when, this.mus); }
    else { f.type = 'highpass'; f.frequency.value = 7000; }
    const v = (kind === 'hat' ? 0.12 : kind === 'open' ? 0.1 : 0.5) * vol;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f); f.connect(g); g.connect(this.mus); src.start(t); src.stop(t + dur + 0.02);
  },
  schedule() {
    if (!this.ctx || !this.musicOn) return; const th = this.theme || MUSIC.hub; const sp16 = 60 / th.bpm / 4;
    const Q = { M: [0, 4, 7], m: [0, 3, 7], s: [0, 5, 7], 7: [0, 4, 10] };
    while (this.nextNote < this.ctx.currentTime + 0.3) {
      const s = this.step, when = Math.max(0, this.nextNote - this.ctx.currentTime), st = s % 16, barN = Math.floor(s / 16), bar = barN % th.prog.length;
      const key = th.root, chordRoot = key * Math.pow(2, th.prog[bar] / 12), q = Q[(th.qual || 'MMmM')[bar % 4]] || Q.M;
      const n = (base, semi) => base * Math.pow(2, semi / 12);
      const D = th.drums || 'pop', big = barN % 8 === 7;
      // drums
      if (D !== 'none') {
        if (st === 0 || st === 8 || (D === 'dance' && (st === 4 || st === 12)) || (D === 'pop' && st === 10)) this.drum('kick', when);
        if (st === 4 || st === 12) this.drum(D === 'dance' ? 'clap' : 'snare', when, 0.8);
        if (D === 'dance' ? st % 4 === 2 : st % 2 === 0) this.drum(D === 'dance' ? 'open' : 'hat', when, st % 4 === 0 ? 0.7 : 1);
        if (big && st >= 12) this.drum('snare', when, 0.5 + (st - 12) * 0.15);
      }
      // bouncy bass
      if (st === 0 || st === 3 || st === 6 || st === 8 || st === 11 || st === 14) this.tone(n(chordRoot / 2, st === 6 || st === 14 ? 12 : st === 11 ? 7 : 0), sp16 * 1.8, th.bass, 0.42, null, when, this.mus);
      // sparkly arpeggio
      if (th.arp !== false) this.tone(n(chordRoot * 2, q[[0, 1, 2, 1][st % 4]] + (st % 8 >= 4 ? 12 : 0)), sp16 * 0.8, 'triangle', 0.07, null, when, this.mus);
      // soft chord pad each bar
      if (st === 0) q.forEach((iv) => this.tone(n(chordRoot, iv), sp16 * 15, 'sine', 0.06, null, when, this.mus));
      // melody (eighth notes, relative to the key)
      if (st % 2 === 0) { const mel = th.mel[(s >> 1) % th.mel.length]; if (mel !== null) { this.tone(n(key * 2, mel), sp16 * 2.6, th.lead, 0.22, null, when, this.mus); if (th.echo) this.tone(n(key * 4, mel), sp16 * 1.4, 'sine', 0.05, null, when + sp16 * 3, this.mus); } }
      this.nextNote += sp16; this.step++;
    }
  },
};
const MUSIC = {
  hub: { bpm: 112, root: 262, prog: [0, 7, 9, 5], qual: 'MMmM', bass: 'triangle', lead: 'triangle', drums: 'pop', echo: true,
    mel: [7, null, 9, 7, 4, null, 2, 4, 7, null, 12, null, 9, 7, 4, null, 2, null, 4, 7, 9, null, 7, 4, 5, null, 4, 2, 0, null, null, null] },
  candy: { bpm: 140, root: 294, prog: [0, 7, 9, 5], qual: 'MMmM', bass: 'square', lead: 'square', drums: 'dance', echo: true,
    mel: [12, 12, 9, 7, 9, null, 7, 4, 7, 7, 4, 2, 4, null, null, 7, 9, 9, 12, 9, 7, null, 4, 7, 5, 5, 4, 2, 0, null, 2, 4] },
  block: { bpm: 132, root: 262, prog: [0, 5, 7, 5], qual: 'MMMM', bass: 'square', lead: 'square', drums: 'pop',
    mel: [0, 4, 7, 4, 0, 4, 7, 12, 11, null, 7, null, 9, 7, 5, 4, 5, 9, 12, 9, 5, 9, 12, 14, 12, null, 11, 9, 7, null, null, null] },
  cloud: { bpm: 118, root: 349, prog: [0, 9, 5, 7], qual: 'MmMM', bass: 'triangle', lead: 'sine', drums: 'pop', echo: true,
    mel: [4, null, 7, null, 12, null, 11, 9, 9, null, 7, null, 4, null, null, null, 5, null, 9, null, 12, null, 14, 12, 11, null, 7, null, 9, null, null, null] },
  jungle: { bpm: 128, root: 220, prog: [0, 5, 7, 5], qual: 'mmMm', bass: 'triangle', lead: 'square', drums: 'dance',
    mel: [0, 3, 5, 7, null, 7, 10, 7, 5, null, 3, 5, 0, null, null, null, 7, 10, 12, 10, 7, null, 5, 7, 3, 5, 3, 0, -2, null, 0, null] },
  space: { bpm: 124, root: 196, prog: [0, 8, 3, 10], qual: 'mMMM', bass: 'sawtooth', lead: 'sawtooth', drums: 'dance', echo: true,
    mel: [12, null, 15, null, 19, null, 17, 15, 12, null, null, 10, 12, null, null, null, 15, null, 17, null, 19, 22, 19, 17, 15, null, 12, null, 10, null, null, null] },
  crystal: { bpm: 136, root: 330, prog: [0, 8, 10, 7], qual: 'mMMM', bass: 'triangle', lead: 'sawtooth', drums: 'dance', echo: true,
    mel: [12, 7, 3, 7, 12, 15, 14, 12, 10, 7, 3, null, 7, 10, 12, null, 15, 12, 8, 12, 15, 17, 15, 12, 14, 10, 7, 10, 14, null, 12, null] },
};
