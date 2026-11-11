// ================================================================
// World: themes, course builder, solids & collision, number gates
// Forward direction is -Z. "d" = distance along the course = -z.
// ================================================================
const TRACK_W = 30, HALF_W = 15;
const WORLDS = {
  candy: { name: '캔디 월드', icon: '🍭', topic: '덧셈과 뺄셈', price: 0, skyTop: 0x2f8cff, skyMid: 0xff8fd8, skyBot: 0xffe36b, fog: 0xffc9ec, floorA: '#ff6fb5', floorB: '#ffd1ea', side: 0xe0438f, rail: ['#ff2d8a', '#ffffff'], accent: 0xff3d9a, ground: 0x7fe08a,
    zones: [['#ff5fae', '#ffe0f0'], ['#ffb020', '#fff2a8'], ['#36d6c3', '#c9fff4'], ['#9b6bff', '#e7dbff'], ['#ff5a5a', '#ffd6d6'], ['#3fb6ff', '#d4f0ff']] },
  block: { name: '블록 월드', icon: '🧱', topic: '두 자리 수와 곱셈', price: 100, skyTop: 0x1f6fff, skyMid: 0x6fd6ff, skyBot: 0xfff08a, fog: 0xcdeeff, floorA: '#ffcc33', floorB: '#ff8a1f', side: 0x3a6fe0, rail: ['#2f6bff', '#ffd23f'], accent: 0x2f6bff, ground: 0x5fd35a,
    zones: [['#ffcc33', '#ff7a1f'], ['#38c95a', '#c8ff8a'], ['#ff4b4b', '#ffd23f'], ['#2f9bff', '#a8e4ff'], ['#b05cff', '#ffd23f'], ['#ff7a1f', '#ffffff']] },
  cloud: { name: '구름 월드', icon: '☁️', topic: '혼합 계산과 분수', price: 300, skyTop: 0x3d7dff, skyMid: 0xc59bff, skyBot: 0xffd0f0, fog: 0xe6dcff, floorA: '#c9d6ff', floorB: '#9fb4ff', side: 0x8fa2ff, rail: ['#a06bff', '#ffffff'], accent: 0x8f5bff, ground: null,
    zones: [['#a9c1ff', '#ffffff'], ['#ffb3e1', '#ffffff'], ['#9ff0ff', '#ffffff'], ['#ffe08a', '#ffffff'], ['#c7a6ff', '#ffffff'], ['#a6ffcf', '#ffffff']] },
  jungle: { name: '정글 월드', icon: '🌴', topic: '곱셈과 나눗셈', price: 200, skyTop: 0x1ea6ff, skyMid: 0x7fffc4, skyBot: 0xfff36b, fog: 0xd0ffd0, floorA: '#9be04a', floorB: '#5fbf3a', side: 0x2f8a3c, rail: ['#1fa84f', '#ffe07a'], accent: 0x22c55e, ground: 0x3fae5a,
    zones: [['#8fe03a', '#d9ff8a'], ['#ff8a3d', '#ffe0a8'], ['#21c7a8', '#b4fff0'], ['#ffd21f', '#fff7b0'], ['#ff4f7a', '#ffd0dc'], ['#4fa8ff', '#d0ecff']] },
  space: { name: '우주 월드', icon: '🚀', topic: '비율과 종합 문제', price: 500, skyTop: 0x05031f, skyMid: 0x3a1680, skyBot: 0xff4fb8, fog: 0x2a1a6a, floorA: '#6f7cff', floorB: '#2c2f8f', side: 0x1f2370, rail: ['#ffd23f', '#3ff0ff'], accent: 0xffd23f, ground: null, gravity: 0.72, neon: true,
    zones: [['#3b2fff', '#00e5ff'], ['#9b1fff', '#ff4fd8'], ['#ff2d6f', '#ffd23f'], ['#00b37a', '#3fffb0'], ['#ff7a00', '#ffd23f'], ['#2f6bff', '#ff4fd8']] },
  crystal: { name: '크리스탈 월드', icon: '💎', topic: '분수와 소수', price: 400, skyTop: 0x22106f, skyMid: 0x8a4dff, skyBot: 0x5ef0ff, fog: 0x9d86ff, floorA: '#b49cff', floorB: '#7b5cff', side: 0x5a3cdf, rail: ['#3ff0ff', '#d36bff'], accent: 0x3ff0ff, ground: 0x5a45c6, neon: true,
    zones: [['#7b5cff', '#3ff0ff'], ['#d36bff', '#ffd1ff'], ['#00c2ff', '#c8f6ff'], ['#ff5fd2', '#ffe0f7'], ['#4f6bff', '#a8ffef'], ['#ffb02e', '#fff0c0']] },
};
const WORLD_ORDER = ['candy', 'block', 'jungle', 'cloud', 'crystal', 'space'];
const WORLD_FEAT = { candy: '사탕 발판 · 젤리 범퍼 · 초콜릿 미끄럼틀', block: '움직이는 블록 벽 · 회전 막대 · 무너지는 다리', jungle: '버섯 범퍼 · 쌍둥이 회전 막대 · 연잎 발판', cloud: '바람 구간 · 구름 발판 · 공중 점프', crystal: '레이저 · 수정 기둥 · 무너지는 다리', space: '낮은 중력 달 점프 · 레이저 · 움직이는 벽' };
WORLD_ORDER.forEach((w, i) => (WORLDS[w].grade = i + 1));

function th_groundY(W) { return WORLDS[W].ground ? -14 : -6; }
// ---------------- Solids ----------------
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
class Solid {
  constructor(obj, shape, hx, hy, hz, opts = {}) {
    this.obj = obj; this.shape = shape; this.hx = hx; this.hy = hy; this.hz = hz;
    this.c = new THREE.Vector3(); this.ax = new THREE.Vector3(); this.ay = new THREE.Vector3(); this.az = new THREE.Vector3();
    this.vel = new THREE.Vector3(); this.angY = 0; this.prev = new THREE.Vector3();
    Object.assign(this, { kind: 'static', bounce: 0, knock: 0, pad: 0, slip: false, conv: null, motion: null, enabled: true, reach: 0 }, opts);
    this.refresh(); this.prev.copy(this.c);
  }
  refresh() {
    this.obj.updateMatrixWorld(true); const e = this.obj.matrixWorld.elements;
    this.ax.set(e[0], e[1], e[2]).normalize(); this.ay.set(e[4], e[5], e[6]).normalize(); this.az.set(e[8], e[9], e[10]).normalize(); this.c.set(e[12], e[13], e[14]);
  }
  zRange() { // conservative z extents (+ motion reach)
    const ext = Math.abs(this.ax.z) * this.hx + Math.abs(this.ay.z) * this.hy + Math.abs(this.az.z) * this.hz + this.reach;
    const r = this.shape === 'cyl' ? this.hx + this.reach : ext;
    return [this.c.z - r, this.c.z + r];
  }
  pointVel(p, out) { out.copy(this.vel); if (this.angY) { out.x += this.angY * (p.z - this.c.z); out.z -= this.angY * (p.x - this.c.x); } return out; }
}
// sphere vs solid. returns depth>0 and sets out normal (world) or returns 0
const _col = { nx: 0, ny: 0, nz: 0, depth: 0 };
function collideSphere(s, px, py, pz, r) {
  const dx = px - s.c.x, dy = py - s.c.y, dz = pz - s.c.z;
  const ax = s.ax, ay = s.ay, az = s.az;
  let lx = dx * ax.x + dy * ax.y + dz * ax.z, ly = dx * ay.x + dy * ay.y + dz * ay.z, lz = dx * az.x + dy * az.y + dz * az.z;
  let nlx, nly, nlz, depth;
  if (s.shape === 'cyl') {
    const R = s.hx, rl = Math.hypot(lx, lz), cy = clamp(ly, -s.hy, s.hy);
    let cx = lx, cz = lz; if (rl > R) { cx = lx * R / rl; cz = lz * R / rl; }
    const ex = lx - cx, ey = ly - cy, ez = lz - cz, d2 = ex * ex + ey * ey + ez * ez;
    if (d2 > r * r) return 0;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); nlx = ex / d; nly = ey / d; nlz = ez / d; depth = r - d; }
    else { const side = R - rl, top = s.hy - Math.abs(ly); if (top < side) { nlx = 0; nly = Math.sign(ly) || 1; nlz = 0; depth = top + r; } else { nlx = rl > 1e-6 ? lx / rl : 1; nly = 0; nlz = rl > 1e-6 ? lz / rl : 0; depth = side + r; } }
  } else {
    const cx = clamp(lx, -s.hx, s.hx), cy = clamp(ly, -s.hy, s.hy), cz = clamp(lz, -s.hz, s.hz);
    const ex = lx - cx, ey = ly - cy, ez = lz - cz, d2 = ex * ex + ey * ey + ez * ez;
    if (d2 > r * r) return 0;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); nlx = ex / d; nly = ey / d; nlz = ez / d; depth = r - d; }
    else {
      const px_ = s.hx - Math.abs(lx), py_ = s.hy - Math.abs(ly), pz_ = s.hz - Math.abs(lz);
      nlx = nly = nlz = 0;
      if (py_ <= px_ && py_ <= pz_) { nly = Math.sign(ly) || 1; depth = py_ + r; } else if (px_ <= pz_) { nlx = Math.sign(lx) || 1; depth = px_ + r; } else { nlz = Math.sign(lz) || 1; depth = pz_ + r; }
    }
  }
  _col.nx = ax.x * nlx + ay.x * nly + az.x * nlz; _col.ny = ax.y * nlx + ay.y * nly + az.y * nlz; _col.nz = ax.z * nlx + ay.z * nly + az.z * nlz; _col.depth = depth;
  return depth;
}
// vertical ray down: returns top y of solid under (x,z) below yFrom, or -Infinity
function rayDownSolid(s, x, yFrom, z) {
  // slab test in local space; ray dir = (0,-1,0)
  const ox = x - s.c.x, oy = yFrom - s.c.y, oz = z - s.c.z;
  const o = [ox * s.ax.x + oy * s.ax.y + oz * s.ax.z, ox * s.ay.x + oy * s.ay.y + oz * s.ay.z, ox * s.az.x + oy * s.az.y + oz * s.az.z];
  const d = [-s.ax.y, -s.ay.y, -s.az.y]; const h = [s.hx, s.hy, s.shape === 'cyl' ? s.hx : s.hz];
  let tmin = 0, tmax = 60;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) { if (Math.abs(o[i]) > h[i]) return -Infinity; }
    else { let t1 = (-h[i] - o[i]) / d[i], t2 = (h[i] - o[i]) / d[i]; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -Infinity; }
  }
  return yFrom - tmin;
}

// ---------------- textures ----------------
function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
function floorTexture(th, A, B, kind = 'check') {
  A = A || th.floorA; B = B || th.floorB;
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = A; g.fillRect(0, 0, w, h); g.fillStyle = B;
    const rr = (x, y, a, b, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, a, b, r) : g.rect(x, y, a, b); g.fill(); };
    if (kind === 'check') { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) rr(x * 64 + 3, y * 64 + 3, 58, 58, 14); }
    else if (kind === 'stripe') { for (let x = -256; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 + 256, 256); g.lineTo(x + 256, 256); g.fill(); } }
    else if (kind === 'dots') { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 64 + 32 + (y % 2) * 0, y * 64 + 32, 20, 0, 7); g.fill(); } g.fillStyle = 'rgba(255,255,255,0.55)'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 64 + 26, y * 64 + 26, 6, 0, 7); g.fill(); } }
    else if (kind === 'chevron') { g.lineWidth = 22; g.strokeStyle = B; g.lineJoin = 'round'; for (let y = -64; y < 320; y += 64) { g.beginPath(); g.moveTo(0, y + 40); g.lineTo(128, y); g.lineTo(256, y + 40); g.stroke(); } }
    else if (kind === 'star') { const star = (cx, cy, R) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.45 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); }; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { star(x * 128 + 64, y * 128 + 64, 46); } g.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.beginPath(); g.arc(x * 128, y * 128, 10, 0, 7); g.fill(); } }
    else if (kind === 'wave') { g.lineWidth = 26; g.strokeStyle = B; for (let y = 16; y < 300; y += 64) { g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 256 * Math.PI * 2) * 14); g.stroke(); } }
    else if (kind === 'rainbow') { const cs = ['#ff3b5c', '#ff9a1f', '#ffe11f', '#3fd35a', '#20b8ff', '#8a5cff']; for (let i = 0; i < 8; i++) { g.fillStyle = cs[i % 6]; g.fillRect(0, i * 32, w, 32); } g.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 6, h); }
    // glossy sparkles
    g.fillStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(RNG() * w, RNG() * h, 1.5 + RNG() * 2.5, 0, 7); g.fill(); }
    // bright border so every tile pops
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  }, true);
}
const VIVID = [0xff2d6f, 0xff8a00, 0xffe600, 0x22e06a, 0x00c8ff, 0x7a5cff, 0xff4fd8];
const ZONE_KINDS = ['check', 'stripe', 'dots', 'chevron', 'star', 'wave'];
const ZONE_EDGES = [0, 124, 232, 332, 432, 532];
function stripeTexture(a, b) { return canvasTex(128, 32, (g) => { g.fillStyle = a; g.fillRect(0, 0, 128, 32); g.fillStyle = b; for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 32, 32); g.lineTo(x + 16, 32); g.fill(); } }, true); }
function arrowTexture(col) { return canvasTex(128, 128, (g) => { g.fillStyle = col; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(255,255,255,0.75)'; for (const y of [20, 84]) { g.beginPath(); g.moveTo(64, y); g.lineTo(100, y + 30); g.lineTo(80, y + 30); g.lineTo(80, y + 40); g.lineTo(48, y + 40); g.lineTo(48, y + 30); g.lineTo(28, y + 30); g.fill(); } }, true); }

// ---------------- Course ----------------
class Course {
  constructor(scene, worldId, level = 3, opts = {}) {
    this.noGates = !!opts.noGates;
    this.scene = scene; this.worldId = worldId; this.th = WORLDS[worldId]; this.level = level; this.df = (level - 1) / 5; this.sp = 0.5 + 0.5 * this.df; this.easy = level <= 2;
    this.group = new THREE.Group(); scene.add(this.group);
    this.solids = []; this.moving = []; this.buckets = []; this.winds = []; this.crumbles = []; this.gates = []; this.checkpoints = []; this.lanesHint = [];
    this.ftex = floorTexture(this.th);
    this.matTop = new THREE.MeshStandardMaterial({ map: this.ftex, roughness: 0.55, envMapIntensity: 0.35 });
    this.matSide = new THREE.MeshStandardMaterial({ color: this.th.side, roughness: 0.5 });
    this.pulse = []; this.spinners = [];
    // every stretch of the course has its own colours and pattern
    const zs = this.th.zones || [[this.th.floorA, this.th.floorB]];
    this.zones = ZONE_EDGES.map((d, i) => { const [A, B0] = zs[i % zs.length]; const B = '#' + new THREE.Color(B0).lerp(new THREE.Color(A), 0.3).getHexString(); return { tex: floorTexture(this.th, A, B, ZONE_KINDS[i % ZONE_KINDS.length]), side: new THREE.MeshStandardMaterial({ color: new THREE.Color(A).multiplyScalar(0.72), roughness: 0.45, envMapIntensity: 0.4 }), edge: new THREE.Color(A).lerp(new THREE.Color(0xffffff), 0.25) }; });
    this.gateTex = floorTexture(this.th, '#ffffff', '#ffffff', 'rainbow');
    this.railTex = stripeTexture(this.th.rail[0], this.th.rail[1]);
    this.warnTex = stripeTexture('#ff2d6f', '#ffe600');
    this.matRail = new THREE.MeshStandardMaterial({ map: this.railTex, roughness: 0.35 });
    this.t = 0;
    this.build();
    this.indexSolids();
    this.group.traverse((o) => { if (o.isMesh && !o.material.transparent && !(o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
  }
  addSolid(obj, shape, hx, hy, hz, opts) { if (!obj.parent) this.group.add(obj); const s = new Solid(obj, shape, hx, hy, hz, opts); this.solids.push(s); if (s.motion) this.moving.push(s); return s; }
  boxMesh(w, h, l, m, top) { const geo = new THREE.BoxGeometry(w, h, l); const mesh = new THREE.Mesh(geo, top ? [m, m, top, m, m, m] : m); return mesh; }
  // floor segment between distances d0..d1, top at y
  floor(d0, d1, y = 0, opts = {}) {
    const w = opts.w || TRACK_W, x = opts.x || 0, th = opts.th || 3, len = d1 - d0;
    const z = this.zoneAt((d0 + d1) / 2), gate = w > TRACK_W + 1;
    const top = this.matTop.clone(); top.map = (gate ? this.gateTex : z.tex).clone(); top.map.needsUpdate = true; top.map.repeat.set(gate ? w / 10 : w / 7.5, gate ? len / 8 : len / 7.5);
    const m = this.boxMesh(w, th, len, z.side, top); m.position.set(x, y - th / 2, -(d0 + d1) / 2);
    const s = this.addSolid(m, 'box', w / 2, th / 2, len / 2, { kind: 'floor' });
    if (opts.rails !== false) this.rails(d0, d1, y, w, x);
    if (opts.rails !== false && len > 3) this.edgeGlow(d0, d1, y, w, x, z.edge);
    return s;
  }
  zoneAt(d) { let i = 0; for (let k = 0; k < ZONE_EDGES.length; k++) if (d >= ZONE_EDGES[k]) i = k; return this.zones[i]; }
  // glowing light strips along both edges of the track (they slowly pulse)
  edgeGlow(d0, d1, y, w, x, col) {
    const m = new THREE.MeshBasicMaterial({ color: col }); this.pulse.push({ m, base: col.clone(), ph: d0 * 0.05, basic: true });
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(GEO.box, m); e.scale.set(0.5, 0.16, d1 - d0); e.position.set(x + sd * (w / 2 - 0.25), y + 0.03, -(d0 + d1) / 2); this.group.add(e); }
  }
  rails(d0, d1, y, w = TRACK_W, x = 0) {
    for (const sd of [-1, 1]) {
      const len = d1 - d0; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 12), this.matRail.clone());
      m.material.map = this.railTex.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(1, len / 2);
      m.rotation.x = Math.PI / 2; m.position.set(x + sd * (w / 2 + 0.1), y + 0.75, -(d0 + d1) / 2);
      this.addSolid(m, 'box', 0.35, len / 2, 0.6, { kind: 'rail' });
      // invisible taller guard so racers don't hop off the course
      const guard = new THREE.Object3D(); guard.position.set(x + sd * (w / 2 + 0.3), y + 2, -(d0 + d1) / 2);
      this.addSolid(guard, 'box', 0.3, 2, len / 2, { kind: 'rail' });
    }
  }
  ramp(d0, d1, y0, y1, opts = {}) {
    const L = d1 - d0, h = y1 - y0, len = Math.hypot(L, h), ang = Math.atan2(h, L), w = opts.w || TRACK_W, th = 1;
    const topMat = opts.slip ? new THREE.MeshStandardMaterial({ color: 0x8a4b2c, roughness: 0.25, metalness: 0.05 }) : this.matTop.clone();
    const z = this.zoneAt((d0 + d1) / 2);
    if (!opts.slip) { topMat.map = z.tex.clone(); topMat.map.needsUpdate = true; topMat.map.repeat.set(w / 7.5, len / 7.5); }
    const m = this.boxMesh(w, th, len, z.side, topMat); m.rotation.x = ang;
    const up = new THREE.Vector3(0, Math.cos(ang), Math.sin(ang));
    m.position.set(opts.x || 0, (y0 + y1) / 2, -(d0 + d1) / 2).addScaledVector(up, -th / 2);
    const s = this.addSolid(m, 'box', w / 2, th / 2, len / 2, { kind: 'floor', slip: !!opts.slip, conv: opts.slip ? new THREE.Vector3(0, 0, -7) : null });
    if (opts.slip) { // chocolate drips decoration
      for (let i = 0; i < 6; i++) { const drip = new THREE.Mesh(GEO.sphere, mat(0x6b3a22, { roughness: 0.2 })); drip.scale.set(rand(0.6, 1.2), 0.3, rand(0.8, 1.6)); const dd = lerp(d0, d1, (i + 0.5) / 6); drip.position.set(rand(-9, 9), lerp(y0, y1, (dd - d0) / L) + 0.05, -dd); this.group.add(drip); }
    }
    // side walls along ramp
    for (const sd of [-1, 1]) { const g = new THREE.Object3D(); g.rotation.x = ang; g.position.set(sd * (w / 2 + 0.3), (y0 + y1) / 2 + 1.5, -(d0 + d1) / 2); this.addSolid(g, 'box', 0.3, 2, len / 2, { kind: 'rail' }); const rm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 12), this.matRail); rm.rotation.x = Math.PI / 2 + ang; rm.position.set(sd * (w / 2 + 0.1), (y0 + y1) / 2 + 0.75, -(d0 + d1) / 2); this.group.add(rm); }
    return s;
  }
  checkpoint(d, y = 0) { this.checkpoints.push({ d, y }); this.checkpoints.sort((a, b) => a.d - b.d); }

  // ---------- obstacles ----------
  // shiny material whose glow pulses so obstacles stand out
  loud(hex, sp = 3) { const m = jellyMaterial(hex); m.envMapIntensity = 0.35; m.sheen = 0; m.emissive = new THREE.Color(hex).multiplyScalar(0.45); m.emissiveIntensity = 0.6; this.pulse.push({ m, ph: rand(0, 6.28), sp }); return m; }
  stripeMat(a, b) { const t = stripeTexture('#' + new THREE.Color(a).getHexString(), '#' + new THREE.Color(b).getHexString()); const m = jellyMaterial(0xffffff); m.envMapIntensity = 0.35; m.sheen = 0; m.map = t; m.emissive = new THREE.Color(0x333333); this.pulse.push({ m, ph: rand(0, 6.28), sp: 2.5, tex: t }); return m; }
  bumpers(d0, d1, n, opts = {}) {
    n = Math.max(2, Math.round(n * (0.55 + 0.45 * this.df))); const placed = [];
    for (let i = 0; i < n * 6 && placed.length < n; i++) {
      const x = rand(-12, 12), d = rand(d0, d1); if (placed.some((p) => Math.hypot(p[0] - x, p[1] - d) < 4)) continue; placed.push([x, d]);
      const R = opts.R || rand(0.8, 1.1), h = 1.6, col = opts.color && !opts.calm ? pick([opts.color, ...VIVID]) : opts.color || pick(VIVID);
      const g = new THREE.Group(); g.position.set(x, (opts.y || 0) + h / 2, -d);
      const lm = this.loud(col, 4);
      const m = new THREE.Mesh(GEO.cyl, lm); m.scale.set(R, h, R); g.add(m);
      const cap = new THREE.Mesh(GEO.sphere, lm); cap.scale.set(R, R * 0.6, R); cap.position.y = h / 2; g.add(cap);
      const c2 = pick(VIVID.filter((v) => v !== col));
      for (const ry of [0.2, 0.9]) { const ring = new THREE.Mesh(GEO.torus, mat(ry > 0.5 ? c2 : 0xffe600, { emissive: new THREE.Color(ry > 0.5 ? c2 : 0xffe600).multiplyScalar(0.4), envMapIntensity: 0.4 })); ring.scale.set(R * 1.04, R * 1.04, 0.6); ring.rotation.x = Math.PI / 2; ring.position.y = ry - h / 2 + 0.6; g.add(ring); }
      const star = new THREE.Mesh(GEO.star, mat(0xffffff, { emissive: 0x888888 })); star.scale.setScalar(R * 0.45); star.position.y = h / 2 + R * 0.75; g.add(star); this.spinners.push({ o: star, sp: 2.2 });
      this.addSolid(g, 'cyl', R, h / 2 + R * 0.3, R, { kind: 'bumper', bounce: 11, vis: g });
    }
  }
  pushers(d0, d1, n, opts = {}) {
    n += Math.floor(this.df * 2.2);
    for (let i = 0; i < n; i++) {
      const d = lerp(d0, d1, (i + 0.5) / n), w = opts.w || 3.2, h = opts.h || 1.6, l = 1.6;
      const col = opts.color || pick(VIVID), c2 = pick(VIVID.filter((v) => v !== col));
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), this.stripeMat(col, c2));
      const amp = opts.amp || 10, sp = rand(0.6, 1.1) * this.sp, ph = rand(0, 6.28), y = (opts.y || 0) + h / 2;
      m.position.set(0, y, -d);
      this.addSolid(m, 'box', w / 2, h / 2, l / 2, { kind: 'pusher', reach: 0, knock: 3, motion: (t, s) => { s.obj.position.x = Math.sin(t * sp + ph) * amp; } });
    }
  }
  sweeper(d, len = 10.5, speed = 1.3, x = 0, y = 0.75, opts = {}) {
    speed *= this.sp;
    const pole = new THREE.Mesh(GEO.cyl, this.stripeMat(0xffffff, pick(VIVID))); pole.scale.set(0.55, 2.6, 0.55); pole.position.set(x, 1.3, -d);
    this.addSolid(pole, 'cyl', 0.55, 1.3, 0.55, { kind: 'pole' });
    const cap = new THREE.Mesh(GEO.sphere, this.loud(pick(VIVID), 5)); cap.scale.setScalar(0.75); cap.position.set(x, 2.7, -d); this.group.add(cap);
    const ca = pick(VIVID), cb = pick(VIVID.filter((v) => v !== ca)); const bm = this.stripeMat(ca, cb); bm.map.repeat.set(len, 1);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len * 2, 0.55, 0.55), bm);
    bar.position.set(x, y, -d); const ph = rand(0, 6.28), dir = opts.dir || (RNG() < 0.5 ? 1 : -1);
    const s = this.addSolid(bar, 'box', len, 0.28, 0.28, { kind: 'sweeper', knock: 9, reach: len, motion: (t, s) => { s.obj.rotation.y = ph + t * speed * dir; s.angY = speed * dir; } });
    for (const e of [-1, 1]) { const ball = new THREE.Mesh(GEO.sphere, this.loud(cb, 6)); ball.scale.setScalar(0.6); ball.position.x = e * len; bar.add(ball); }
    return s;
  }
  jumpPad(d, x, y = 0, power = 17) {
    const g = new THREE.Group(); g.position.set(x, y + 0.15, -d);
    const base = new THREE.Mesh(GEO.cyl, mat(0xffffff)); base.scale.set(1.3, 0.3, 1.3); g.add(base);
    const pc = pick(VIVID); const top = new THREE.Mesh(GEO.cyl, this.loud(pc, 6)); top.scale.set(1.1, 0.12, 1.1); top.position.y = 0.18; g.add(top);
    const halo = new THREE.Mesh(GEO.torus, new THREE.MeshBasicMaterial({ color: pc })); halo.scale.set(1.5, 1.5, 0.5); halo.rotation.x = Math.PI / 2; halo.position.y = 0.12; g.add(halo);
    const arrow = new THREE.Mesh(GEO.cone, mat(0xffffff, { emissive: 0x666666 })); arrow.scale.set(0.45, 0.4, 0.45); arrow.position.y = 0.45; g.add(arrow);
    return this.addSolid(g, 'cyl', 1.25, 0.15, 1.25, { kind: 'pad', pad: power, vis: top, arrow });
  }
  gapPlatforms(d0, d1, y, rows = 3, opts = {}) {
    const len = d1 - d0, rowL = 3.2, gap = (len - rows * rowL) / (rows + 1);
    for (let r = 0; r < rows; r++) {
      const dc = d0 + gap * (r + 1) + rowL * (r + 0.5); const sp = rand(0.5, 0.8) * this.sp, ph = rand(0, 6.28);
      for (const off of [-4.5, 4.5]) {
        const m = this.boxMesh(4.2, 1, rowL, this.matSide, this.loud(opts.color || pick(VIVID), 2));
        m.position.set(off, y - 0.5, -dc);
        this.addSolid(m, 'box', 2.1, 0.5, rowL / 2, { kind: 'platform', motion: (t, s) => { s.obj.position.x = off * 0.3 + Math.sin(t * sp + ph + (off > 0 ? Math.PI : 0)) * 4.2; } });
      }
    }
    // narrow fixed bridge on one side (safe but crowded path)
    const bw = this.level <= 4 ? 5 : 2.6, bx = (opts.bridgeX ?? 1) > 0 ? HALF_W - bw / 2 - 0.4 : -(HALF_W - bw / 2 - 0.4); this.floor(d0 - 0.5, d1 + 0.5, y, { w: bw, x: bx, th: 0.8, rails: false });
    this.lanesHint.push({ d0, d1, x: bx });
  }
  crumbleBridge(d0, d1, y) {
    const tile = 2.4, cols = 5, rows = Math.floor((d1 - d0) / tile);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * tile * 1.02, d = d0 + (r + 0.5) * ((d1 - d0) / rows);
      const m = this.boxMesh(tile - 0.12, 0.8, tile - 0.12, mat(0xd9a05b), mat(VIVID[(r * 2 + c) % VIVID.length], { roughness: 0.35 })); m.position.set(x, y - 0.4, -d);
      const s = this.addSolid(m, 'box', tile / 2 - 0.06, 0.4, tile / 2 - 0.06, { kind: 'crumble', home: m.position.clone(), timer: -1, down: 0 });
      this.crumbles.push(s);
    }
    { const bw = this.level <= 4 ? 5 : 2.6, bx = -(HALF_W - bw / 2 - 0.4); this.floor(d0 - 0.2, d1 + 0.2, y, { w: bw, x: bx, th: 0.8, rails: false }); this.lanesHint.push({ d0, d1, x: bx }); }
  }
  jumpGap(d, gapLen = 2.6, y = 0) { if (this.easy) return; if (this.level <= 4) gapLen = 2.1; this.holes = this.holes || []; this.holes.push([d, d + gapLen, y]); }
  windZone(d0, d1, amp = 9) {
    amp *= 0.45 + 0.55 * this.df;
    const ph = rand(0, 6.28); this.winds.push({ d0, d1, f: (t) => Math.sin(t * 0.9 + ph) * amp });
    const tex = arrowTexture('rgba(255,255,255,0)'); tex.repeat.set(4, (d1 - d0) / 6);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W, d1 - d0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.03, -(d0 + d1) / 2); this.group.add(m); this.winds[this.winds.length - 1].vis = m; m.material.map.rotation = Math.PI / 2; m.material.map.center.set(0.5, 0.5);
  }
  // big ball on a swinging arm that sweeps across the track
  pendulum(d, opts = {}) {
    const L = 8.6, piv = 11, R = 1.6, A = opts.amp || 1.05, sp = (opts.speed || 1.5) * (0.75 + 0.5 * this.df), ph = rand(0, 6.28);
    const fc = pick(VIVID), fm = this.stripeMat(fc, 0xffffff);
    for (const sd of [-1, 1]) { const post = new THREE.Mesh(GEO.cyl, fm); post.scale.set(0.5, piv + 1, 0.5); post.position.set(sd * (HALF_W + 1), (piv + 1) / 2 - 0.5, -d); this.group.add(post); }
    const beam = new THREE.Mesh(GEO.box, this.loud(fc, 2)); beam.scale.set(TRACK_W + 2.5, 0.7, 0.7); beam.position.set(0, piv + 0.3, -d); this.group.add(beam);
    const arm = new THREE.Group(); arm.position.set(0, piv, -d); this.group.add(arm);
    const rod = new THREE.Mesh(GEO.cyl, mat(0xffffff, { roughness: 0.3 })); rod.scale.set(0.18, L, 0.18); rod.position.y = -L / 2; arm.add(rod);
    const bc = pick(VIVID.filter((v) => v !== fc));
    const ball = new THREE.Mesh(GEO.sphere, this.stripeMat(bc, 0xffe600)); ball.scale.setScalar(R); ball.position.set(0, piv - L, -d);
    for (let i = 0; i < 6; i++) { const sp2 = new THREE.Mesh(GEO.cone, mat(0xffffff, { emissive: 0x444444 })); sp2.scale.set(0.35, 0.7, 0.35); const a = i / 6 * Math.PI * 2; sp2.position.set(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0); sp2.rotation.z = a - Math.PI / 2; ball.add(sp2); }
    this.addSolid(ball, 'cyl', R, R, R, { kind: 'sweeper', knock: 11, reach: L * Math.sin(A) + 1, motion: (t, s) => { const a = Math.sin(t * sp + ph) * A; arm.rotation.z = a; s.obj.position.x = Math.sin(a) * L; s.obj.position.y = piv - Math.cos(a) * L; s.obj.rotation.z = -a * 2; } });
  }
  // blocks that punch out from the side walls
  punchers(d0, d1, n) {
    for (let i = 0; i < n; i++) {
      const d = lerp(d0, d1, (i + 0.5) / n), sd = i % 2 ? 1 : -1, sp = rand(0.45, 0.6) * (0.8 + 0.5 * this.df), ph = rand(0, 1), ext = 6.5;
      const c = pick(VIVID), house = new THREE.Mesh(GEO.box, this.stripeMat(0x2a1f60, c)); house.scale.set(3, 3.4, 3); house.position.set(sd * (HALF_W + 1.8), 1.7, -d); this.group.add(house);
      const g = new THREE.Group(); g.position.set(sd * (HALF_W + 1.5), 1.3, -d);
      const rod = new THREE.Mesh(GEO.box, mat(0xdddddd)); rod.scale.set(ext, 0.5, 0.5); rod.position.x = sd * ext / 2; g.add(rod);
      const fist = new THREE.Mesh(GEO.box, this.loud(c, 6)); fist.scale.set(1.4, 2.4, 2.6); g.add(fist);
      const ring = new THREE.Mesh(GEO.torus, mat(0xffffff)); ring.scale.set(1.2, 1.2, 0.8); ring.rotation.y = Math.PI / 2; ring.position.x = -sd * 0.72; g.add(ring);
      const hx = sd * (HALF_W + 1.5);
      this.addSolid(g, 'box', 0.7, 1.2, 1.3, { kind: 'sweeper', knock: 10, reach: 0, motion: (t, s) => {
        const p = (t * sp + ph) % 1; const e = p < 0.1 ? p / 0.1 : p < 0.4 ? 1 : p < 0.7 ? 1 - (p - 0.4) / 0.3 : 0;
        s.obj.position.x = hx - sd * e * ext; } });
    }
  }
  // heavy jelly stamps that slam down; a glowing ring on the floor warns where
  stompers(d0, d1, n) {
    for (let i = 0; i < n; i++) {
      const d = lerp(d0, d1, (i + 0.5) / n), x = n === 1 ? 0 : rand(-8, 8), sp = rand(0.32, 0.42) * (0.8 + 0.5 * this.df), ph = rand(0, 1), hh = 1.1, low = 1.0, high = 8;
      const c = pick(VIVID), m = new THREE.Mesh(new THREE.BoxGeometry(4.2, hh * 2, 4.2), this.loud(c, 4)); m.position.set(x, high, -d);
      const face = new THREE.Mesh(GEO.star, mat(0xffffff, { emissive: 0x777777 })); face.scale.setScalar(1.1); face.rotation.x = Math.PI / 2; face.position.y = -hh - 0.05; m.add(face);
      const warn = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.3, 28), new THREE.MeshBasicMaterial({ color: 0xff2d6f, transparent: true, opacity: 0.4, depthWrite: false })); warn.rotation.x = -Math.PI / 2; warn.position.set(x, 0.06, -d); this.group.add(warn);
      this.addSolid(m, 'box', 2.1, hh, 2.1, { kind: 'stomper', reach: 0, motion: (t, s) => {
        const p = (t * sp + ph) % 1; const k = p < 0.45 ? 0 : p < 0.55 ? (p - 0.45) / 0.1 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3; // wait up, slam, stay, rise
        s.obj.position.y = high - (high - low - hh) * (k * k); warn.material.opacity = p > 0.3 && p < 0.55 ? 0.45 + 0.45 * Math.sin(t * 30) : 0.3; } });
    }
  }
  // giant striped balls rolling down the track toward the racers
  rollers(d0, d1, n) {
    const span = d1 - d0, mid = (d0 + d1) / 2, v = 7 + 5 * this.df;
    for (let i = 0; i < n; i++) {
      const R = 2, x = lerp(-9, 9, n === 1 ? 0.5 : i / (n - 1)) + rand(-1.5, 1.5), off = span * i / n + rand(0, 4), c = pick(VIVID);
      const tex = canvasTex(256, 128, (g, w, h) => { const cs = ['#' + new THREE.Color(c).getHexString(), '#ffffff', '#' + new THREE.Color(pick(VIVID)).getHexString(), '#ffffff']; for (let k = 0; k < 8; k++) { g.fillStyle = cs[k % 4]; g.fillRect(k * w / 8, 0, w / 8 + 1, h); } });
      const m = new THREE.Mesh(GEO.sphere, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, envMapIntensity: 0.4, emissive: new THREE.Color(c).multiplyScalar(0.15) })); m.scale.setScalar(R); m.position.set(x, R, -mid);
      this.addSolid(m, 'cyl', R * 0.95, R, R * 0.95, { kind: 'sweeper', knock: 12, reach: span / 2 + R, motion: (t, s) => {
        const u = ((t * v + off) % span); const z = -(d1 - u); s.obj.position.z = z; s.obj.rotation.x = u / R;
        const e = Math.min(1, u / 3, (span - u) / 3); s.obj.scale.setScalar(R * Math.max(0.05, e)); s.enabled = e > 0.5; } });
    }
  }
  // moving belt that drags racers backwards
  conveyor(d0, d1, speed, y = 0) {
    const len = d1 - d0, w = TRACK_W - 1.4;
    const tex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = '#2a2350'; g.fillRect(0, 0, W, H); g.strokeStyle = '#ffe600'; g.lineWidth = 14; g.lineJoin = 'round'; for (const y0 of [24, 88]) { g.beginPath(); g.moveTo(20, y0 + 22); g.lineTo(64, y0); g.lineTo(108, y0 + 22); g.stroke(); } }, true);
    tex.repeat.set(w / 4, len / 4);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, envMapIntensity: 0.3, emissive: 0x221a40 })); m.position.set(0, y + 0.06, -(d0 + d1) / 2);
    this.addSolid(m, 'box', w / 2, 0.06, len / 2, { kind: 'floor', conv: new THREE.Vector3(0, 0, speed) });
    (this.belts = this.belts || []).push({ tex, speed });
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(GEO.box, this.stripeMat(0xffe600, 0x2a2350)); e.scale.set(0.5, 0.3, len); e.position.set(sd * (w / 2 + 0.25), y + 0.12, -(d0 + d1) / 2); this.group.add(e); }
  }
  laser(d, mode = 'updown', opts = {}) {
    const m = new THREE.Mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: opts.color || 0xff3df0 })); m.rotation.z = Math.PI / 2; m.scale.set(0.16, TRACK_W, 0.16);
    const glow = new THREE.Mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: opts.color || 0xff3df0, transparent: true, opacity: 0.3, depthWrite: false })); glow.scale.set(2.4, 1, 2.4); m.add(glow);
    m.position.set(0, 0.6, -d); const ph = rand(0, 6.28), sp = (opts.speed || 1.4) * this.sp;
    for (const sd of [-1, 1]) { const post = new THREE.Mesh(GEO.box, this.stripeMat(0x2a1f60, opts.color || 0xff3df0)); post.scale.set(0.8, 3.8, 0.8); post.position.set(sd * (HALF_W + 0.2), 1.9, -d); this.group.add(post); const bulb = new THREE.Mesh(GEO.sphere, this.loud(opts.color || 0xff3df0, 8)); bulb.scale.setScalar(0.55); bulb.position.set(sd * (HALF_W + 0.2), 4.1, -d); this.group.add(bulb); }
    const motion = mode === 'updown' ? (t, s) => { s.obj.position.y = 0.55 + (Math.sin(t * sp + ph) * 0.5 + 0.5) * 2.4; } : (t, s) => { s.obj.position.y = 0.5; };
    return this.addSolid(m, 'box', 0.14, HALF_W, 0.14, { kind: 'laser', knock: 8, motion: mode === 'updown' ? motion : null });
  }
  pillars(d0, d1, n, color) {
    for (let i = 0; i < n; i++) {
      const x = rand(-12, 12), d = rand(d0, d1), h = rand(2.2, 3.6);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, clearcoat: 1, emissive: new THREE.Color(color).multiplyScalar(0.25), transparent: true, opacity: 0.9 }));
      m.scale.set(0.9, h / 2 + 0.4, 0.9); m.position.set(x, h / 2, -d); m.rotation.y = rand(0, 3);
      this.addSolid(m, 'cyl', 0.75, h / 2, 0.75, { kind: 'pillar' });
    }
  }
  movingWall(d, opts = {}) {
    const hole = this.easy ? 8 : this.level <= 4 ? 6 : 4.6, h = 2.4, col = opts.color || 0x4f8cff, amp = 8, sp = rand(0.5, 0.8) * this.sp, ph = rand(0, 6);
    for (const sd of [-1, 1]) {
      const w = TRACK_W; const sm = this.stripeMat(col, sd > 0 ? 0xffe600 : 0xffffff); sm.map.repeat.set(w / 3, 1); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), sm); m.position.set(0, h / 2, -d);
      this.addSolid(m, 'box', w / 2, h / 2, 0.6, { kind: 'pusher', reach: 0, motion: (t, s) => { const hx = Math.sin(t * sp + ph) * amp; s.obj.position.x = hx + sd * (hole / 2 + w / 2); } });
    }
  }
  // ---------- gate (9 doors in a single horizontal row) ----------
  gate(d, idx) {
    if (this.noGates) { this.floor(d - 12, d + 12, 0); this.bumpers(d - 7, d + 7, 6, { color: this.th.accent }); return null; }
    // wide plaza so the doors can be big
    this.floor(d - 12, d + 12, 0, { w: GATE_W });
    for (const dd of [d - 12, d + 12]) for (const sd of [-1, 1]) {
      const w = GATE_HALF - HALF_W + 0.6, x = sd * (HALF_W + w / 2);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, w, 10), this.matRail.clone()); m.rotation.z = Math.PI / 2; m.position.set(x, 0.75, -dd); this.group.add(m);
      const o = new THREE.Object3D(); o.position.set(x, 2, -dd); this.addSolid(o, 'box', w / 2, 2.4, 0.4, { kind: 'rail' });
    }
    const G = new NumberGate(this, d, idx); this.gates.push(G); return G;
  }

  build() {
    const W = this.worldId, th = this.th;
    // --- start ---
    this.floor(-12, 40, 0); this.checkpoint(4);
    const startArch = makeBannerArch('START', th.accent); startArch.position.set(0, 0, -19); this.group.add(startArch);
    const backWall = new THREE.Object3D(); backWall.position.set(0, 2, 12.5); this.addSolid(backWall, 'box', HALF_W, 3, 0.5, { kind: 'rail' });
    // --- Section A (40..112) ---
    this.floor(40, 112, 0);
    if (W === 'candy') { this.bumpers(44, 70, 9); this.pushers(76, 92, 3); this.sweeper(97, 10.5, 1.2); }
    if (W === 'block') { this.pushers(44, 62, 4, { jelly: false }); this.movingWall(72, { color: 0x4f8cff }); this.movingWall(86, { color: 0xffb02e }); this.sweeper(97, 10.5, 1.4); }
    if (W === 'cloud') { this.windZone(42, 76, 8); this.bumpers(48, 74, 6, { color: 0xffffff }); this.sweeper(88, 10.5, 1.1); this.bumpers(94, 105, 4, { color: 0xd6ccff }); }
    if (W === 'jungle') { this.bumpers(44, 66, 8, { color: 0xff6b5a }); this.pushers(74, 90, 3); this.sweeper(97, 10.5, 1.3); }
    if (W === 'space') { this.laser(50, 'low', { color: 0x7fe7ff }); this.movingWall(66, { color: 0x8a7bff }); this.pillars(76, 92, 6, 0xffd23f); this.sweeper(97, 10.5, 1.5); }
    if (W === 'crystal') { this.laser(48, 'updown'); this.pillars(54, 70, 7, 0x8be9ff); this.laser(78, 'updown', { speed: 1.9 }); this.laser(88, 'low', { color: 0x5ef0ff }); this.sweeper(97, 10.5, 1.5); }
    this.checkpoint(60);
    const L = this.level;
    if (L >= 3) this.pendulum(106);
    if (L >= 4) this.punchers(54, 70, L >= 6 ? 3 : 2);
    // --- Gate 1 ---
    this.gate(124, 0); this.checkpoint(128.5);
    // --- Section B (136..220): ramp up, plateau with pads, gap challenge, slide down ---
    this.floor(136, 142, 0); this.ramp(142, 154, 0, 3); this.floor(154, 170, 3);
    this.jumpPad(160, -7, 3); this.jumpPad(160, 7, 3); this.checkpoint(162, 3);
    if (this.easy) { this.floor(170, 188, 3); this.bumpers(173, 186, 5, { y: 3 }); } else if (W === 'block' || (W === 'crystal')) { this.crumbleBridge(170, 188, 3); } else { this.gapPlatforms(170, 188, 3, 3); }
    this.floor(188, 196, 3); this.checkpoint(190, 3);
    if (W === 'crystal' && !this.easy) this.gapPlatforms(196, 206, 3, 1, { color: 0x8be9ff, bridgeX: -9.6 }), this.floor(206, 208, 3), this.ramp(208, 216, 3, 0, { slip: true }), this.floor(216, 220, 0);
    else { this.ramp(196, 214, 3, 0, { slip: true }); this.floor(214, 220, 0); }
    // --- Gate 2 ---
    this.gate(232, 1); this.checkpoint(236.5);
    // --- Section C (244..320) ---
    this.jumpGap(262, 2.6); this.jumpGap(298, 2.8);
    this.floorWithHoles(244, 320, 0);
    if (W === 'candy') { this.sweeper(252, 10.5, 1.3); this.bumpers(270, 292, 6); this.sweeper(308, 6, 1.6, -5.5); this.sweeper(310, 6, 1.6, 5.5); }
    if (W === 'block') { this.sweeper(252, 6, 1.5, -5.5); this.sweeper(254, 6, 1.5, 5.5); this.pushers(270, 292, 3, { jelly: false }); this.movingWall(310, { color: 0x5fe0b0 }); }
    if (W === 'cloud') { this.windZone(244, 296, 9); this.sweeper(276, 10.5, 1.2); this.bumpers(302, 316, 5, { color: 0xffffff }); }
    if (W === 'jungle') { this.sweeper(252, 6, 1.4, -5.5); this.sweeper(254, 6, 1.4, 5.5); this.bumpers(270, 292, 7, { color: 0xff6b5a }); this.pushers(304, 316, 2); }
    if (W === 'space') { this.laser(252, 'updown', { speed: 1.8, color: 0xffd23f }); this.movingWall(274, { color: 0x7fe7ff }); this.sweeper(288, 10.5, 1.6); this.pillars(306, 318, 4, 0x8a7bff); }
    if (W === 'crystal') { this.sweeper(252, 10.5, 1.6); this.laser(274, 'updown', { speed: 2 }); this.pushers(282, 292, 2); this.laser(308, 'updown', { color: 0x5ef0ff, speed: 1.6 }); this.pillars(312, 318, 3, 0xff9cf5); }
    this.checkpoint(266); this.checkpoint(302);
    if (L >= 2) this.pendulum(316, { speed: 1.3 });
    if (L >= 5) this.rollers(284, 298, L >= 6 ? 3 : 2);
    // --- Gate 3 ---
    this.gate(332, 2); this.checkpoint(336.5);
    // --- Section D (344..420) ---
    this.floor(344, 420, 0);
    this.pushers(350, 366, 3, W === 'block' ? { jelly: false } : {}); this.sweeper(378, 10.5, 1.4); this.bumpers(388, 404, 6, { color: th.accent });
    this.checkpoint(372);
    if (L >= 3) this.pendulum(345, { speed: 1.4 });
    if (L >= 4) this.punchers(388, 404, L >= 6 ? 4 : 3);
    if (L >= 2) this.conveyor(404, 416, 2 + 2 * this.df);
    // --- Gate 4 ---
    this.gate(432, 3); this.checkpoint(436.5);
    // --- Section E (444..520) ---
    this.jumpGap(480, 2.6);
    this.floorWithHoles(444, 520, 0);
    this.movingWall(456, { color: th.accent }); this.sweeper(468, 6, 1.5, -5.5); this.sweeper(470, 6, 1.5, 5.5); this.bumpers(490, 506, 6, { color: th.accent });
    this.checkpoint(486);
    if (L >= 3) this.stompers(508, 518, L >= 5 ? 3 : 2);
    if (L >= 5) this.rollers(484, 506, L >= 6 ? 3 : 2);
    // --- Gate 5 ---
    this.gate(532, 4); this.checkpoint(536.5);
    // --- Final (544..632) ---
    this.jumpGap(580, 2.6);
    this.floorWithHoles(544, 632, 0);
    this.jumpPad(556, -8, 0); this.jumpPad(556, 0, 0); this.jumpPad(556, 8, 0);
    if (W === 'candy' || W === 'cloud') this.bumpers(562, 576, 6, W === 'cloud' ? { color: 0xffffff } : {});
    if (W === 'block') this.pushers(562, 576, 3, { jelly: false });
    if (W === 'jungle') this.bumpers(562, 576, 6, { color: 0xff6b5a });
    if (W === 'space') { this.laser(566, 'updown', { speed: 2, color: 0x7fe7ff }); this.bumpers(570, 577, 3, { color: 0xffd23f }); }
    if (W === 'crystal') { this.laser(566, 'updown', { speed: 2.2 }); this.bumpers(570, 577, 3, { color: 0x8be9ff }); }
    this.pushers(592, 602, 2, { amp: 7 });
    this.checkpoint(584);
    if (L >= 2) this.pendulum(607, { speed: 1.2 });
    if (L >= 4) this.pendulum(588, { speed: 1.6 });
    if (L >= 6) this.punchers(564, 576, 2);
    this.FINISH = 612;
    const fin = makeBannerArch('FINISH', 0xffd23f, true); fin.position.set(0, 0, -this.FINISH); this.group.add(fin);
    const endWall = new THREE.Object3D(); endWall.position.set(0, 3, -632.5); this.addSolid(endWall, 'box', HALF_W, 4, 0.5, { kind: 'rail' });
    const endDeco = new THREE.Mesh(new THREE.BoxGeometry(TRACK_W, 3, 1), jellyMaterial(th.accent)); endDeco.position.set(0, 1.5, -632.6); this.group.add(endDeco);
    this.LENGTH = this.FINISH;
    this.sections = [0, 124, 232, 332, 432, 532, this.FINISH];
    this.buildScenery();
  }
  floorWithHoles(d0, d1, y) {
    const holes = (this.holes || []).filter((h) => h[0] >= d0 && h[1] <= d1).sort((a, b) => a[0] - b[0]);
    let cur = d0; for (const h of holes) { this.floor(cur, h[0], y); cur = h[1]; this.holeDeco(h); } this.floor(cur, d1, y);
  }
  holeDeco(h) { // glowing edge strips to make gaps readable
    for (const d of [h[0], h[1]]) { const m = new THREE.Mesh(GEO.box, mat(0xffffff, { emissive: 0xffe680 })); m.scale.set(TRACK_W, 0.12, 0.3); m.position.set(0, h[2] + 0.02, -d); this.group.add(m); }
  }
  buildScenery() {
    const th = this.th, W = this.worldId, grp = this.group;
    // ground far below / sea of clouds
    if (th.ground) { const g = new THREE.Mesh(new THREE.PlaneGeometry(600, 1400), mat(th.ground, { roughness: 1 })); g.rotation.x = -Math.PI / 2; g.position.set(0, -14, -300); grp.add(g); }
    const cloudM = W === 'space' ? mat(0x7a63d8, { roughness: 0.9, emissive: 0x2a1f70 }) : mat(0xffffff, { roughness: 0.9, emissive: 0x666677 });
    if (W === 'space') { const n = 700, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rand(0, 6.283), e = rand(-0.25, 1), r = 560; pos[i * 3] = Math.cos(a) * Math.sqrt(1 - e * e) * r; pos[i * 3 + 1] = e * r; pos[i * 3 + 2] = Math.sin(a) * Math.sqrt(1 - e * e) * r - 300; } const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const st = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 })); st.frustumCulled = false; grp.add(st); }
    const puff = (x, y, z, s) => { const c = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(GEO.sphereLo, cloudM); b.scale.setScalar(s * rand(0.6, 1.1)); b.position.set((i - 2) * s * 0.8, rand(0, s * 0.4), rand(-s * 0.3, s * 0.3)); c.add(b); } c.position.set(x, y, z); grp.add(c); return c; };
    for (let i = 0; i < 36; i++) puff(rand(-140, 140) + (RNG() < 0.5 ? -50 : 50) * 0, rand(18, 50), -rand(-60, 720), rand(4, 9)).position.x = (RNG() < 0.5 ? -1 : 1) * rand(40, 150);
    if (W === 'cloud') for (let i = 0; i < 56; i++) puff((RNG() < 0.5 ? -1 : 1) * rand(16, 70), rand(-12, -4), -rand(-20, 660), rand(3, 7));
    // side decorations
    const side = () => (RNG() < 0.5 ? -1 : 1);
    for (let i = 0; i < 100; i++) {
      const d = rand(-20, 650), x = side() * (rand(HALF_W + 6, HALF_W + 34) + (this.gates.some((G) => Math.abs(G.d - d) < 18) ? 9 : 0)), y = W === 'cloud' || W === 'space' ? rand(-6, 2) : -1;
      const o = this.decoItem(W); o.position.set(x, y, -d); o.rotation.y = rand(0, 6.28); grp.add(o);
    }
    // festival decor: bunting lines + balloons along the course
    const flagCols = [0xff5a7a, 0xffd23f, 0x5fd35f, 0x3fc2ff, 0xa86bff, 0xff9a3c];
    const flagGeo = new THREE.ConeGeometry(0.32, 0.7, 3); flagGeo.rotateX(Math.PI); flagGeo.scale(1, 1, 0.15);
    for (let d = 30; d < 620; d += 34) {
      if (this.gates.some((G) => Math.abs(G.d - d) < 16)) continue;
      const y = (d > 150 && d < 200 ? 3 : 0) + 10.5;
      for (const sd of [-1, 1]) { const pole = new THREE.Mesh(GEO.cyl, mat(0xffffff)); pole.scale.set(0.18, y + 1, 0.18); pole.position.set(sd * (HALF_W + 1.6), (y + 1) / 2 - 1, -d); grp.add(pole); const top = new THREE.Mesh(GEO.sphere, jellyMaterial(pick(flagCols))); top.scale.setScalar(0.45); top.position.set(sd * (HALF_W + 1.6), y + 0.2, -d); grp.add(top); }
      for (let i = 0; i < 25; i++) { const u = i / 24, x = lerp(-HALF_W - 1.6, HALF_W + 1.6, u); const f = new THREE.Mesh(flagGeo, mat(flagCols[i % 6], { side: THREE.DoubleSide })); f.position.set(x, y - Math.sin(u * Math.PI) * 1.6 - 0.5, -d); grp.add(f); }
    }
    this.balloons = [];
    for (let i = 0; i < 40; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(GEO.sphere, jellyMaterial(pick(flagCols))); b.scale.set(1.1, 1.35, 1.1); g.add(b); const st = new THREE.Mesh(GEO.cyl, mat(0xffffff)); st.scale.set(0.03, 3, 0.03); st.position.y = -2.8; g.add(st); g.position.set(side() * rand(HALF_W + 3, HALF_W + 14), rand(5, 13), -rand(0, 630)); if (this.gates.some((G) => Math.abs(G.d + g.position.z) < 18)) g.position.x += Math.sign(g.position.x) * 9; g.userData.y0 = g.position.y; g.userData.ph = rand(0, 6); grp.add(g); this.balloons.push(g); }
    this.landmarks(W);
    // big landmark: rainbow-ish ring over the finish area
    const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 1.6, 12, 48, Math.PI), new THREE.MeshBasicMaterial({ color: 0xff9ccf, transparent: true, opacity: 0.55 }));
    ring.position.set(0, -2, -680); grp.add(ring);
    const ring2 = ring.clone(); ring2.material = new THREE.MeshBasicMaterial({ color: 0x9be3ff, transparent: true, opacity: 0.55 }); ring2.scale.setScalar(0.93); grp.add(ring2);
    const ring3 = ring.clone(); ring3.material = new THREE.MeshBasicMaterial({ color: 0xffe17a, transparent: true, opacity: 0.55 }); ring3.scale.setScalar(0.86); grp.add(ring3);
  }
  // giant, colourful things far from the track so the background is never plain
  landmarks(W) {
    const grp = this.group, RB = [0xff3b5c, 0xff9a1f, 0xffe11f, 0x3fd35a, 0x20b8ff, 0x8a5cff];
    const rainbow = (x, z, R, rotY) => { const g = new THREE.Group(); RB.forEach((c, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(R - i * 1.6, 0.85, 8, 40, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, fog: false })); g.add(t); }); g.position.set(x, -6, z); g.rotation.y = rotY; grp.add(g); };
    for (let i = 0; i < 4; i++) rainbow((i % 2 ? 1 : -1) * rand(80, 120), -rand(60, 640), rand(34, 46), rand(-0.6, 0.6));
    const glow = (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: new THREE.Color(hex).multiplyScalar(0.55), roughness: 0.4 });
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1, x = side * rand(55, 140), z = -rand(-40, 700), c = pick(VIVID), g = new THREE.Group();
      if (W === 'candy') { const s = new THREE.Mesh(GEO.cyl, mat(0xffffff)); s.scale.set(0.8, 26, 0.8); s.position.y = 13; g.add(s); const tex = canvasTex(256, 256, (cx, w, h) => { const cs = ['#' + new THREE.Color(c).getHexString(), '#ffffff', '#' + new THREE.Color(pick(VIVID)).getHexString()]; for (let k = 0; k < 18; k++) { cx.fillStyle = cs[k % 3]; cx.beginPath(); cx.moveTo(128, 128); cx.arc(128, 128, 128, k / 18 * 6.283, (k + 1) / 18 * 6.283); cx.fill(); } }); const p = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 2, 32), [glow(c), new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]); p.rotation.x = Math.PI / 2; p.position.y = 30; g.add(p); this.spinners.push({ o: p, sp: 0 }); }
      else if (W === 'block') { let y = 0; for (let k = 0, n = randi(3, 6); k < n; k++) { const s = rand(6, 11); const b = new THREE.Mesh(GEO.box, glow(VIVID[(i + k) % VIVID.length])); b.scale.setScalar(s); b.position.set(rand(-2, 2), y + s / 2, rand(-2, 2)); b.rotation.y = rand(0, 1); y += s; g.add(b); } }
      else if (W === 'jungle') { const h = rand(30, 60); const mtn = new THREE.Mesh(GEO.cone, mat(pick([0x2fa85a, 0x3fbf6a, 0x1f8f4a]), { roughness: 0.9 })); mtn.scale.set(h * 0.7, h, h * 0.7); mtn.position.y = h / 2 - 10; g.add(mtn); const fl = new THREE.Mesh(GEO.sphere, glow(c)); fl.scale.set(6, 2.5, 6); fl.position.y = h - 10; g.add(fl); for (let k = 0; k < 5; k++) { const pt = new THREE.Mesh(GEO.sphereLo, glow(pick(VIVID))); pt.scale.set(4, 1.2, 2); const a = k / 5 * 6.283; pt.position.set(Math.cos(a) * 5, h - 9, Math.sin(a) * 5); pt.rotation.y = -a; g.add(pt); } }
      else if (W === 'cloud') { const isl = new THREE.Mesh(GEO.cone, mat(0xc9a27a)); isl.scale.set(12, 14, 12); isl.rotation.x = Math.PI; isl.position.y = 0; g.add(isl); const top = new THREE.Mesh(GEO.cyl, mat(0x7fe08a)); top.scale.set(12, 2, 12); top.position.y = 7.5; g.add(top); const tw = new THREE.Mesh(GEO.cyl, glow(c)); tw.scale.set(3, 14, 3); tw.position.y = 15; g.add(tw); const rf = new THREE.Mesh(GEO.cone, glow(pick(VIVID))); rf.scale.set(4.5, 6, 4.5); rf.position.y = 25; g.add(rf); g.position.y = rand(5, 25); this.spinners.push({ o: g, sp: 0, bob: rand(0, 6), y0: g.position.y, amp: 2 }); }
      else if (W === 'space') { const R = rand(8, 18); const pl = new THREE.Mesh(GEO.sphere, glow(c)); pl.scale.setScalar(R); g.add(pl); const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.6, R * 0.12, 6, 48), new THREE.MeshBasicMaterial({ color: pick(VIVID), transparent: true, opacity: 0.8 })); ring.rotation.x = 1.2; g.add(ring); g.position.y = rand(20, 70); this.spinners.push({ o: g, sp: rand(0.1, 0.3) }); }
      else { const n = randi(2, 4); for (let k = 0; k < n; k++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ color: VIVID[(i + k) % VIVID.length], emissive: new THREE.Color(VIVID[(i + k) % VIVID.length]).multiplyScalar(0.5), roughness: 0.05, clearcoat: 1 })); cr.scale.set(rand(3, 6), rand(12, 28), rand(3, 6)); cr.position.set(rand(-6, 6), 0, rand(-6, 6)); cr.rotation.z = rand(-0.3, 0.3); g.add(cr); } g.position.y = -4; }
      if (W !== 'cloud' && W !== 'space') g.position.y += th_groundY(W);
      g.position.x = x; g.position.z = z; grp.add(g);
    }
    // giant spinning stars in the sky
    for (let i = 0; i < 10; i++) { const c = pick(VIVID); const s = new THREE.Mesh(GEO.star, new THREE.MeshBasicMaterial({ color: c, fog: false })); s.scale.setScalar(rand(3, 6)); s.position.set((i % 2 ? 1 : -1) * rand(30, 90), rand(28, 55), -rand(0, 680)); grp.add(s); this.spinners.push({ o: s, sp: rand(0.4, 1), bob: rand(0, 6), y0: s.position.y, amp: 3 }); }
  }
  decoItem(W) {
    const g = new THREE.Group();
    if (W === 'candy') {
      const k = randi(0, 2);
      if (k === 0) { const stick = new THREE.Mesh(GEO.cyl, mat(0xffffff)); stick.scale.set(0.2, 6, 0.2); stick.position.y = 3; g.add(stick); const pop = new THREE.Mesh(GEO.cyl, mat(pick([0xff7eb6, 0x7fe7ff, 0xffd84d, 0xa77bff]), { roughness: 0.3 })); pop.scale.set(2, 0.5, 2); pop.rotation.x = Math.PI / 2; pop.position.y = 6.5; g.add(pop); }
      else if (k === 1) { const trunk = new THREE.Mesh(GEO.cyl, mat(0xc98a5a)); trunk.scale.set(0.4, 3, 0.4); trunk.position.y = 1.5; g.add(trunk); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(GEO.sphereLo, mat(pick([0xffb3d9, 0xffc9e6, 0xff9ccf]))); b.scale.setScalar(rand(1.4, 2)); b.position.set(rand(-1, 1), 3.5 + i * 0.8, rand(-1, 1)); g.add(b); } }
      else { const c = new THREE.Mesh(GEO.cone, mat(0xffd9a0)); c.scale.set(1.2, 2.5, 1.2); c.rotation.x = Math.PI; c.position.y = 1.25; g.add(c); const s = new THREE.Mesh(GEO.sphereLo, mat(pick([0xff9ccf, 0xfff0f5, 0xa7f0c8]))); s.scale.setScalar(1.3); s.position.y = 2.7; g.add(s); }
    } else if (W === 'block') {
      const n = randi(2, 5); for (let i = 0; i < n; i++) { const b = new THREE.Mesh(GEO.box, mat(pick([0xff5a5a, 0x4f8cff, 0xffd23f, 0x5fe0b0, 0xff9a3c]), { roughness: 0.5 })); const s = rand(1.5, 3); b.scale.setScalar(s); b.position.set(rand(-1.5, 1.5), i * 2.2 + s / 2, rand(-1.5, 1.5)); b.rotation.y = rand(0, 1); g.add(b); }
    } else if (W === 'jungle') {
      if (RNG() < 0.62) {
        const h = rand(4.5, 7); const trunk = new THREE.Mesh(GEO.cyl, mat(0xa9713f)); trunk.scale.set(0.38, h, 0.38); trunk.position.y = h / 2; trunk.rotation.z = rand(-0.12, 0.12); g.add(trunk);
        for (let i = 0; i < 6; i++) { const lf = new THREE.Mesh(GEO.sphereLo, mat(pick([0x3fbf6a, 0x57d17a, 0x2fa85a]))); lf.scale.set(2.3, 0.22, 0.75); const a = i / 6 * Math.PI * 2; lf.position.set(Math.cos(a) * 1.7, h - 0.35, Math.sin(a) * 1.7); lf.rotation.y = -a; lf.rotation.z = -0.45; g.add(lf); }
        const co = new THREE.Mesh(GEO.sphereLo, mat(0x8a5a2a)); co.scale.setScalar(0.42); co.position.set(0.3, h - 0.5, 0.2); g.add(co);
      } else { const s = rand(0.8, 1.6); const stem = new THREE.Mesh(GEO.cyl, mat(0xfff4e0)); stem.scale.set(0.55 * s, 1.6 * s, 0.55 * s); stem.position.y = 0.8 * s; g.add(stem); const cap = new THREE.Mesh(GEO.sphereLo, mat(pick([0xff6b5a, 0xffb02e, 0xff7eb6]), { roughness: 0.35 })); cap.scale.set(1.7 * s, 0.95 * s, 1.7 * s); cap.position.y = 1.7 * s; g.add(cap); for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(GEO.sphereLo, mat(0xffffff)); d.scale.setScalar(0.24 * s); const a = i * 1.57 + 0.4; d.position.set(Math.cos(a) * 1.05 * s, 2.25 * s, Math.sin(a) * 1.05 * s); g.add(d); } }
    } else if (W === 'space') {
      if (RNG() < 0.7) { const s = rand(1.2, 3.2), c = pick([0xff9a6b, 0x7fe7ff, 0xffd23f, 0xc59cff, 0x7dffcf]); const pl = new THREE.Mesh(GEO.sphere, mat(c, { roughness: 0.5, emissive: new THREE.Color(c).multiplyScalar(0.25) })); pl.scale.setScalar(s); pl.position.y = 4; g.add(pl); if (RNG() < 0.6) { const rg = new THREE.Mesh(new THREE.TorusGeometry(s * 1.65, s * 0.1, 8, 32), mat(0xffffff, { emissive: 0x666688 })); rg.position.y = 4; rg.rotation.set(1.2, 0, rand(-0.5, 0.5)); g.add(rg); } }
      else { const b = new THREE.Mesh(GEO.cyl, mat(0xffffff, { roughness: 0.3 })); b.scale.set(0.8, 3, 0.8); b.position.y = 4; g.add(b); const n = new THREE.Mesh(GEO.cone, mat(0xff5a7a)); n.scale.set(0.8, 1.4, 0.8); n.position.y = 6.2; g.add(n); for (const sx of [-1, 1]) { const f = new THREE.Mesh(GEO.box, mat(0xff5a7a)); f.scale.set(0.7, 1, 0.15); f.position.set(sx * 0.95, 3, 0); g.add(f); } const fl = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: 0xffc23f })); fl.scale.set(0.5, 1.5, 0.5); fl.rotation.x = Math.PI; fl.position.y = 1.9; g.add(fl); g.rotation.z = rand(-0.5, 0.5); }
      g.position.y = rand(-2, 6);
    } else if (W === 'cloud') {
      const isl = new THREE.Mesh(GEO.cone, mat(0xc9a27a)); isl.scale.set(3, 3, 3); isl.rotation.x = Math.PI; g.add(isl); const top = new THREE.Mesh(GEO.cyl, mat(0x9be89b)); top.scale.set(3, 0.6, 3); top.position.y = 1.6; g.add(top);
      if (RNG() < 0.6) { const tr = new THREE.Mesh(GEO.sphereLo, mat(0x7fd36b)); tr.scale.setScalar(1.2); tr.position.y = 3; g.add(tr); }
      g.position.y = rand(-4, 4);
    } else {
      const n = randi(1, 4); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ color: pick([0x8be9ff, 0xff9cf5, 0xc5a3ff, 0x7dffcf]), roughness: 0.05, clearcoat: 1, emissive: 0x302060 })); c.scale.set(rand(0.8, 1.6), rand(2, 5), rand(0.8, 1.6)); c.position.set(rand(-2, 2), 2, rand(-2, 2)); c.rotation.z = rand(-0.4, 0.4); g.add(c); }
    }
    return g;
  }

  indexSolids() {
    const B = 6; this.B = B; this.buckets = [];
    for (const s of this.solids) {
      let [z0, z1] = s.zRange(); z0 -= 1.5; z1 += 1.5; const b0 = Math.max(0, Math.floor(-z1 / B) + 2), b1 = Math.max(0, Math.floor(-z0 / B) + 2);
      for (let b = b0; b <= b1; b++) (this.buckets[b] = this.buckets[b] || []).push(s);
    }
  }
  near(z) { const b = Math.floor(-z / this.B) + 2; return this.buckets[b] || EMPTY; }
  update(t, dt) {
    this.t = t;
    for (const s of this.moving) {
      s.prev.copy(s.c); s.motion(t, s); s.refresh();
      if (dt > 0) s.vel.subVectors(s.c, s.prev).divideScalar(dt);
    }
    for (const s of this.crumbles) {
      if (s.timer >= 0) {
        s.timer += dt;
        if (s.timer < 0.55) { s.obj.position.x = s.home.x + Math.sin(s.timer * 60) * 0.06; }
        else if (s.timer < 3.8) { s.enabled = false; s.obj.position.y -= dt * 9; s.obj.visible = s.obj.position.y > s.home.y - 14; }
        else { s.timer = -1; s.enabled = true; s.obj.visible = true; s.obj.position.copy(s.home); }
        s.refresh();
      }
    }
    for (const w of this.winds) { if (w.vis) { w.cur = w.f(t); w.vis.material.map.offset.y -= dt * w.cur * 0.08; w.vis.material.map.rotation = w.cur > 0 ? -Math.PI / 2 : Math.PI / 2; w.vis.material.opacity = 0.15 + Math.min(0.5, Math.abs(w.cur) / 18); } }
    for (const G of this.gates) G.update(dt);
    for (const p of this.pulse) { const k = 0.5 + 0.5 * Math.sin(t * (p.sp || 2) + p.ph); if (p.basic) p.m.color.copy(p.base).multiplyScalar(0.75 + 0.45 * k); else p.m.emissiveIntensity = 0.35 + 1.1 * k; if (p.tex) p.tex.offset.x = t * 0.4; }
    if (this.belts) for (const b of this.belts) b.tex.offset.y = (t * b.speed / 4) % 1;
    for (const s of this.spinners) { s.o.rotation.y += dt * s.sp; if (s.bob) s.o.position.y = s.y0 + Math.sin(t * 0.8 + s.bob) * s.amp; }
    if (this.balloons) for (const b of this.balloons) { b.position.y = b.userData.y0 + Math.sin(t * 0.8 + b.userData.ph) * 0.5; b.rotation.z = Math.sin(t * 0.6 + b.userData.ph) * 0.08; }
    for (const s of this.solids) if (s.kind === 'pad' && s.padAnim > 0) { s.padAnim -= dt; s.vis.position.y = 0.18 + Math.sin(s.padAnim * 30) * 0.12 * s.padAnim; }
  }
  windAt(d, t) { for (const w of this.winds) if (d >= w.d0 && d <= w.d1) return w.f(t); return 0; }
  groundAt(x, z, yFrom = 20, lead = 0) {
    let best = -Infinity;
    for (const s of this.near(z)) {
      if (!s.enabled || s.kind === 'rail' || s.kind === 'door' || s.kind === 'laser' || s.kind === 'sweeper') continue;
      const xx = lead ? x - s.vel.x * lead : x, zz = lead ? z - s.vel.z * lead : z;
      const y = rayDownSolid(s, xx, yFrom, zz); if (y > best) best = y;
    }
    return best;
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); }); }
}
const EMPTY = [];

function makeBannerArch(text, color, checker) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(GEO.cyl, jellyMaterial(color)); p.scale.set(0.7, 7, 0.7); p.position.set(s * (HALF_W + 0.8), 3.5, 0); g.add(p); const b = new THREE.Mesh(GEO.sphere, jellyMaterial(0xffffff)); b.scale.setScalar(0.9); b.position.set(s * (HALF_W + 0.8), 7.3, 0); g.add(b); }
  const tex = canvasTex(1024, 128, (c, w, h) => {
    if (checker) { for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { c.fillStyle = (x + y) % 2 ? '#222' : '#fff'; c.fillRect(x * 32, y * 32, 32, 32); } c.fillStyle = 'rgba(255,210,63,0.92)'; c.fillRect(260, 8, 504, 112); }
    else { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff9ccf'); gr.addColorStop(0.5, '#ffd84d'); gr.addColorStop(1, '#7fe7ff'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }
    c.font = `bold 92px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 12; c.strokeStyle = '#7a3b8f'; c.strokeText(text, w / 2, h / 2 + 4); c.fillStyle = '#fff'; c.fillText(text, w / 2, h / 2 + 4);
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(TRACK_W + 2.4, 1.6, 0.4), [mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff), new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
  banner.position.y = 6.6; g.add(banner);
  return g;
}

// ---------------- Number Energy Gate ----------------
// Round based: racers gather on the numbered floor pads, the answer is revealed after a countdown,
// racers standing on a correct pad pass first, the others pass through the correct doors a moment later.
const DOOR_COLORS = ['#ff5a7a', '#ffc21a', '#4fcf5f', '#3fb4ff', '#a86bff'], N_DOORS = 5;
const GATE_W = 40, GATE_HALF = GATE_W / 2, SLOT_W = GATE_W / N_DOORS, DOOR_W = 6.4, DOOR_H = 5.6;
const GATE_ZONE = 8, GATE_GATHER = 9, GATE_THINK = 5, GATE_COUNT = 3, GATE_HOLD = 1.5, PAD_LEN = 6.6;
let _portalTex = null;
function portalTextures() {
  if (_portalTex) return _portalTex;
  _portalTex = DOOR_COLORS.map((col) => canvasTex(128, 224, (g, w, h) => {
    g.save(); g.beginPath(); g.moveTo(0, h); g.lineTo(0, 64); g.arc(64, 64, 64, Math.PI, 0); g.lineTo(128, h); g.closePath(); g.clip();
    const gr = g.createRadialGradient(64, 120, 4, 64, 120, 130); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(255,255,255,0.4)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 5; for (let r = 12; r < 120; r += 16) { g.beginPath(); g.arc(64, 120, r, r * 0.1, r * 0.1 + Math.PI * 1.3); g.stroke(); }
    g.restore();
  }));
  return _portalTex;
}
function drawGateNumber(g, text, cx, cy, max) {
  g.textAlign = 'center'; g.textBaseline = 'middle'; const maxW = max * 1.5;
  if (text.includes('/')) { const [n, d] = text.split('/'); const f2 = max * 0.58; g.font = `bold ${f2}px ${FONT}`; g.fillText(n, cx, cy - f2 * 0.55); g.fillRect(cx - f2 * 0.8, cy - 4, f2 * 1.6, 8); g.fillText(d, cx, cy + f2 * 0.65); return; }
  const fit = (t, start) => { let fs = start; g.font = `bold ${fs}px ${FONT}`; while (g.measureText(t).width > maxW && fs > 14) { fs -= 3; g.font = `bold ${fs}px ${FONT}`; } return fs; };
  const wordy = /[가-힣A-Za-z]/.test(text);
  if (wordy && text.length >= 5) { // long words: two lines
    let k = text.indexOf(' '); if (k < 1 || k > text.length - 2) k = Math.ceil(text.length / 2); const a = text.slice(0, k).trim(), b = text.slice(k).trim();
    const fs = Math.min(fit(a, max * 0.5), fit(b, max * 0.5)); g.font = `bold ${fs}px ${FONT}`; g.fillText(a, cx, cy - fs * 0.52); g.fillText(b, cx, cy + fs * 0.62); return;
  }
  let fs = max; if (text.length >= 3) fs = max * 0.76; if (text.length >= 4) fs = max * 0.6; if (text.length >= 5) fs = max * 0.48; if (text.length >= 6) fs = max * 0.4;
  fs = fit(text, wordy ? Math.min(fs, max * 0.7) : fs); g.fillText(text, cx, cy + fs * 0.06);
}
function badgeCanvas(text, color, state, c) {
  c = c || document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = state === 'locked' || state === 'wrong' ? '#b9b3c9' : state === 'correct' ? '#ffc21a' : color; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.fillStyle = state === 'correct' ? '#fffbe0' : state === 'wrong' ? 'rgba(235,232,242,0.95)' : 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.fill();
  g.fillStyle = state === 'locked' || state === 'wrong' ? '#9a94ac' : '#3a2350';
  drawGateNumber(g, text, 128, 130, 128);
  return c;
}
function padCanvas(text, color, state, c) {
  c = c || document.createElement('canvas'); c.width = 448; c.height = 512; const g = c.getContext('2d'), w = 448, h = 512; g.clearRect(0, 0, w, h);
  const fill = state === 'locked' || state === 'wrong' ? '#cfc9dd' : state === 'correct' ? '#ffd84d' : color;
  g.globalAlpha = state === 'wrong' ? 0.4 : state === 'correct' ? 0.95 : 0.72; g.fillStyle = fill; g.beginPath(); g.roundRect ? g.roundRect(8, 8, w - 16, h - 16, 44) : g.rect(8, 8, w - 16, h - 16); g.fill();
  g.globalAlpha = 1; g.lineWidth = 14; g.strokeStyle = 'rgba(255,255,255,0.92)'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(224, 200, 160, 0, Math.PI * 2); g.fill();
  g.fillStyle = state === 'locked' || state === 'wrong' ? '#9a94ac' : '#3a2350'; drawGateNumber(g, text, 224, 202, 200);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (state === 'correct') { g.font = `bold 84px ${FONT}`; g.fillStyle = '#b4690e'; g.fillText('정답!', 224, 440); }
  else if (state === 'open') { g.font = `bold 70px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText('▲ ▲ ▲', 224, 440); }
  return c;
}
class NumberGate {
  constructor(course, d, idx) {
    this.course = course; this.d = d; this.z = -d; this.idx = idx; this.state = 'idle'; this.timer = 0; this.round = 0; this.revealT = 0; this.q = null; this.doors = []; this.decoys = [];
    this.passed = new Set(); this.allowed = new Map(); this.pending = new Set(); this.ghost = 0; this.ghostK = 0; this.answerText = '';
    const grp = (this.group = new THREE.Group()); grp.position.set(0, 0, -d); course.group.add(grp);
    const ptex = portalTextures();
    // nothing is drawn above the doors (keeps the view clear); an invisible wall stops racers hopping over
    const topWall = new THREE.Object3D(); topWall.position.set(0, DOOR_H + 6, -d); course.addSolid(topWall, 'box', GATE_HALF + 1, 6, 0.5, { kind: 'rail' });
    // small side posts
    for (const s of [-1, 1]) { const t = new THREE.Mesh(GEO.cyl, jellyMaterial(course.th.accent)); t.scale.set(0.9, 3.4, 0.9); t.position.set(s * (GATE_HALF + 1), 1.7, 0); grp.add(t); const cap = new THREE.Mesh(GEO.sphere, mat(0xffd23f)); cap.scale.setScalar(0.75); cap.position.set(s * (GATE_HALF + 1), 3.9, 0); grp.add(cap); }
    // pillars between doors (collision)
    for (let i = 0; i <= N_DOORS; i++) {
      const x0 = i === 0 ? -GATE_HALF : -GATE_HALF + SLOT_W * i - (SLOT_W - DOOR_W) / 2, x1 = i === N_DOORS ? GATE_HALF : -GATE_HALF + SLOT_W * i + (SLOT_W - DOOR_W) / 2;
      const w = x1 - x0, o = new THREE.Object3D(); o.position.set((x0 + x1) / 2, DOOR_H / 2, -d);
      course.addSolid(o, 'box', w / 2, DOOR_H / 2, 0.5, { kind: 'rail' });
    }
    const R = DOOR_W / 2 + 0.1, postH = DOOR_H - R;
    const padGeo = new THREE.PlaneGeometry(SLOT_W - 0.3, PAD_LEN); padGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < N_DOORS; i++) {
      const x = -GATE_HALF + SLOT_W * (i + 0.5), col = DOOR_COLORS[i];
      const frame = new THREE.Group(); frame.position.set(x, 0, 0); grp.add(frame);
      const fm = jellyMaterial(new THREE.Color(col).getHex());
      for (const s of [-1, 1]) { const p = new THREE.Mesh(GEO.cyl, fm); p.scale.set(0.34, postH, 0.34); p.position.set(s * R, postH / 2, 0); frame.add(p); }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(R, 0.34, 10, 28, Math.PI), fm); arch.position.y = postH; frame.add(arch);
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, DOOR_H), new THREE.MeshBasicMaterial({ map: ptex[i], transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      portal.position.y = DOOR_H / 2; frame.add(portal);
      const shield = new THREE.Mesh(new THREE.CircleGeometry(3, 6), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      shield.position.set(0, 2.7, 0.45); frame.add(shield);
      const badgeCv = badgeCanvas('?', col, 'locked'); const badgeTex = new THREE.CanvasTexture(badgeCv); badgeTex.colorSpace = THREE.SRGBColorSpace;
      const badge = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true })); badge.position.set(0, DOOR_H - 2.5, 0.4); frame.add(badge);
      const padCv = padCanvas('?', col, 'locked'); const padTex = new THREE.CanvasTexture(padCv); padTex.colorSpace = THREE.SRGBColorSpace; padTex.anisotropy = 4;
      const pad = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); pad.position.set(x, 0.02, 0.7 + PAD_LEN / 2); grp.add(pad);
      const o = new THREE.Object3D(); o.position.set(x, DOOR_H / 2, -d);
      const solid = course.addSolid(o, 'box', DOOR_W / 2, DOOR_H / 2, 0.35, { kind: 'door', gate: this, door: i });
      this.doors.push({ i, x, frame, fm, portal, shield, badge, badgeTex, badgeCv, padTex, padCv, pad, solid, color: col, value: '?', correct: false, shieldT: 0, flashT: 0 });
    }
    this.buildWalls();
  }
  buildWalls() { // lane walls that rise during the countdown so nobody can switch pads
    const course = this.course, d = this.d, wm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.72, emissive: 0x6fc8ff, emissiveIntensity: 0.6 });
    this.walls = []; this.wallK = 0; this.wallsUp = false;
    const add = (x, zc, hx, hz) => {
      const m = new THREE.Mesh(GEO.box, wm); m.scale.set(hx * 2, 2.4, hz * 2); m.position.set(x, 1.2, zc); m.visible = false; this.group.add(m);
      const o = new THREE.Object3D(); o.position.set(x, 6, -d + zc); const solid = course.addSolid(o, 'box', hx, 6, hz, { kind: 'rail', enabled: false });
      this.walls.push({ m, solid });
    };
    for (let i = 1; i < N_DOORS; i++) add(-GATE_HALF + SLOT_W * i, 0.4 + GATE_ZONE / 2, 0.22, GATE_ZONE / 2);
    // gathering barrier in front of the pads: stays up until everyone has arrived
    const bm = new THREE.MeshPhysicalMaterial({ color: 0xff9ccf, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.62, emissive: 0xff5fa2, emissiveIntensity: 0.35 });
    const b = new THREE.Mesh(GEO.box, bm); b.scale.set(GATE_W, 3, 0.5); b.position.set(0, 1.5, GATE_ZONE + 0.4); this.group.add(b);
    const bo = new THREE.Object3D(); bo.position.set(0, 6, -d + GATE_ZONE + 0.4); const bs = course.addSolid(bo, 'box', GATE_HALF, 6, 0.25, { kind: 'rail' });
    this.barrier = { m: b, solid: bs, k: 1, up: true };
  }
  get barrierUp() { return !(this.state === 'ask' && this.timer > GATE_COUNT); }
  get locked() { return (this.state === 'ask' && this.timer <= GATE_COUNT) || (this.state === 'reveal' && this.revealT < GATE_HOLD); }
  slotAt(x) { return clamp(Math.floor((x + GATE_HALF) / SLOT_W), 0, N_DOORS - 1); }
  paint(mode) { // mode: locked | open | reveal
    for (const dr of this.doors) {
      const st = mode === 'reveal' ? (dr.correct ? 'correct' : 'wrong') : mode, txt = mode === 'locked' ? '?' : dr.value;
      badgeCanvas(txt, dr.color, st, dr.badgeCv); dr.badgeTex.needsUpdate = true; padCanvas(txt, dr.color, st, dr.padCv); dr.padTex.needsUpdate = true;
    }
  }
  startRound(level) {
    this.round++; this.state = 'ask'; this.timer = GATE_THINK + GATE_COUNT; this.revealT = 0; this.pending.clear();
    this.q = (this.course.qmaker || makeQuestion)(level); const b = buildDoors(this.q, N_DOORS); this.correctCount = b.correctCount;
    this.doors.forEach((dr, i) => { dr.value = b.values[i]; dr.correct = isCorrect(this.q, dr.value); });
    this.answerText = (this.doors.find((x) => x.correct) || {}).value || '';
    this.decoys = shuffle(this.doors.filter((x) => !x.correct)).slice(0, 2);
    this.paint('open');
  }
  reveal() { this.state = 'reveal'; this.revealT = 0; this.paint('reveal'); }
  close() { this.state = 'idle'; this.pending.clear(); for (const k of this.allowed.keys()) this.allowed.set(k, 0); this.paint('locked'); }
  update(dt) {
    if (this.state === 'ask') this.timer -= dt;
    else if (this.state === 'reveal') { this.revealT += dt; for (const [r, t] of this.allowed) if (t > 0) this.allowed.set(r, t - dt); }
    const up = this.locked; if (up !== this.wallsUp) { this.wallsUp = up; for (const w of this.walls) w.solid.enabled = up; }
    this.wallK = damp(this.wallK, up ? 1 : 0, 12, dt); for (const w of this.walls) { w.m.visible = this.wallK > 0.02; w.m.scale.y = 2.4 * Math.max(0.02, this.wallK); w.m.position.y = 1.2 * this.wallK; }
    const B = this.barrier, bu = this.barrierUp; if (bu !== B.up) { B.up = bu; B.solid.enabled = bu; }
    B.k = damp(B.k, bu ? 1 : 0, 10, dt); B.m.visible = B.k > 0.02; B.m.scale.y = 3 * Math.max(0.02, B.k); B.m.position.y = 1.5 * B.k; B.m.material.opacity = 0.62 * (1 - 0.85 * this.ghostK);
    this.ghostK = damp(this.ghostK, this.ghost, 7, dt); const gk = this.ghostK, vis = 1 - gk;
    for (const dr of this.doors) {
      const open = this.state === 'reveal' && dr.correct;
      dr.portal.scale.x = damp(dr.portal.scale.x, open ? 0.04 : 1, 10, dt); dr.portal.material.opacity = (0.9 - 0.85 * (1 - dr.portal.scale.x)) * (1 - 0.92 * gk);
      dr.badge.material.opacity = 1 - 0.9 * gk;
      const tr = gk > 0.02; if (dr.fm.transparent !== tr) { dr.fm.transparent = tr; dr.fm.needsUpdate = true; } dr.fm.opacity = tr ? 1 - 0.82 * gk : 1;
      if (dr.shieldT > 0) { dr.shieldT -= dt; dr.shield.material.opacity = Math.min(0.8, dr.shieldT * 2) * vis; dr.shield.scale.setScalar(1 + (0.5 - Math.min(0.5, dr.shieldT)) * 0.4); dr.shield.rotation.z += dt * 2; } else dr.shield.material.opacity = 0;
      if (dr.flashT > 0) { dr.flashT -= dt; dr.frame.scale.setScalar(1 + Math.sin(dr.flashT * 20) * 0.04 * dr.flashT); }
      else if (open) dr.frame.scale.setScalar(1 + Math.sin(this.revealT * 8) * 0.012);
    }
  }
}
