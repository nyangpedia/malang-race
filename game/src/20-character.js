// ================================================================
// 3D Mallang character: jelly body, canvas faces, accessories, squash & stretch
// ================================================================
const COLORS = {
  pink: { name: '딸기 핑크', hex: 0xff7eb6, price: 0 }, sky: { name: '소다 블루', hex: 0x5cc8ff, price: 0 }, lemon: { name: '레몬 옐로', hex: 0xffd84d, price: 0 },
  mint: { name: '민트', hex: 0x5fe0b0, price: 40 }, grape: { name: '포도 보라', hex: 0xa77bff, price: 40 }, peach: { name: '복숭아', hex: 0xffa77a, price: 40 },
  milk: { name: '우유 화이트', hex: 0xfff4f0, price: 60 }, lime: { name: '라임', hex: 0x9be35a, price: 60 }, coral: { name: '코랄', hex: 0xff6b6b, price: 60 },
  choco: { name: '초코', hex: 0xb07a5a, price: 80 }, navy: { name: '밤하늘', hex: 0x5a6cff, price: 80 }, rainbow: { name: '오로라', hex: 0xd99bff, price: 200 },
};
const AI_COLORS = [0xff7eb6, 0x5cc8ff, 0xffd84d, 0x5fe0b0, 0xa77bff, 0xffa77a, 0xfff4f0, 0x9be35a, 0xff6b6b, 0xb07a5a, 0x5a6cff, 0xffb3e0, 0x7fe7ff, 0xffc36b];

// --- body geometry: soft mochi with flat bottom and a gentle drop tip ---
function deformMochi(geo, scale = 1) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).divideScalar(scale);
    let y = v.y;
    if (y < -0.45) y = -0.45 + (y + 0.45) * 0.3; // flat squishy bottom
    const w = 1.1 - 0.25 * Math.pow(Math.max(0, y), 1.5) + 0.05 * Math.max(0, -y);
    v.x *= w; v.z *= w * 0.96;
    if (y > 0.55) y += Math.pow(y - 0.55, 2) * 0.9; // soft tip
    v.y = y * 0.92;
    v.multiplyScalar(scale);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
// ghost-slime: a round dome on top, soft sides that flare a little, and a scalloped hem at the bottom
function deformGhost(geo, scale = 1) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).divideScalar(scale);
    const hr = Math.hypot(v.x, v.z), th = Math.atan2(v.z, v.x), dx = hr > 1e-6 ? v.x / hr : 0, dz = hr > 1e-6 ? v.z / hr : 0;
    let r, y;
    if (v.y >= 0) { r = hr * (1 - 0.06 * v.y); y = v.y * 1.02; }
    else {
      const t = -v.y; // 0 at the equator, 1 at the bottom pole
      if (t < 0.9) { const k = t / 0.9; r = 1 + 0.16 * k * k; y = -k * 1.05; const wv = Math.sin(th * 6); r += 0.035 * wv * k * k; y += 0.09 * wv * Math.pow(k, 3); }
      else { const k = (t - 0.9) / 0.1; r = (1.16 + 0.035 * Math.sin(th * 6)) * (1 - k); y = -1.05 + 0.09 * Math.sin(th * 6) * (1 - k) + 0.12 * k; }
      if (hr < 1e-6) r = 0;
    }
    // squeeze into the same height as before so hats and faces still fit (-0.566 .. 1.087)
    const yy = -0.566 + (y + 1.14) / 2.16 * 1.653;
    v.set(dx * r * 1.02, yy, dz * r * 0.98).multiplyScalar(scale);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
const BODY_OFFSET_Y = 0.474; // so bottom sits at y=0 (computed from deform: (-0.45-0.55*0.3)*0.92 ≈ -0.566 → we lift slightly less for contact)
function makeBodyGeo(seg) { const g = deformGhost(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.9))); g.translate(0, 0.566, 0); return g; }
function makeFaceGeo() { const g = deformGhost(new THREE.SphereGeometry(1.012, 28, 18, Math.PI / 2 - 0.85, 1.7, 0.55, 1.15), 1.012); g.translate(0, 0.566, 0); return g; }
let GEO = null;
function initCharacterAssets() {
  GEO = {
    bodyHi: makeBodyGeo(36), bodyLo: makeBodyGeo(14), face: makeFaceGeo(),
    sphere: new THREE.SphereGeometry(1, 16, 12), sphereLo: new THREE.SphereGeometry(1, 10, 8),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 16), torus: new THREE.TorusGeometry(1, 0.25, 10, 24),
    box: new THREE.BoxGeometry(1, 1, 1), leaf: (() => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(0.5, 0.12, 1); return g; })(),
    star: makeStarGeo(1, 0.45, 0.35),
  };
  FACES.init();
  PATTERNS.init();
}
function makeStarGeo(R, r, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 }); g.center(); return g;
}

// --- faces drawn on canvas (shared textures) ---
const FACES = {
  list: { normal: '기본', happy: '활짝', wink: '윙크', sparkle: '반짝', cool: '시크', heart: '하트', sleepy: '졸림', determined: '불끈' },
  price: { normal: 0, happy: 0, wink: 50, sparkle: 70, cool: 70, heart: 90, sleepy: 50, determined: 60 },
  mats: {},
  init() {
    const all = ['normal', 'happy', 'wink', 'sparkle', 'cool', 'heart', 'sleepy', 'determined', 'squash', 'dizzy', 'surprise', 'joy', 'oops'];
    for (const n of all) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; this.draw(c.getContext('2d'), n);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      this.mats[n] = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    }
  },
  draw(g, n) {
    const L = 196, R = 316, Y = 112, ink = '#2b1d33';
    g.clearRect(0, 0, 512, 256); g.lineCap = 'round'; g.lineJoin = 'round';
    // blush
    const blush = (x) => { const gr = g.createRadialGradient(x, Y + 52, 2, x, Y + 52, 34); gr.addColorStop(0, 'rgba(255,90,140,0.55)'); gr.addColorStop(1, 'rgba(255,90,140,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, Y + 52, 40, 24, 0, 0, Math.PI * 2); g.fill(); };
    blush(L - 44); blush(R + 44);
    const eye = (x, s = 1) => { g.fillStyle = ink; g.beginPath(); g.ellipse(x, Y, 17 * s, 24 * s, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 6 * s, Y - 9 * s, 7 * s, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x + 6 * s, Y + 8 * s, 3.2 * s, 0, Math.PI * 2); g.fill(); };
    const arcEye = (x, up = true) => { g.strokeStyle = ink; g.lineWidth = 9; g.beginPath(); if (up) g.arc(x, Y + 10, 17, Math.PI * 1.15, Math.PI * 1.85); else g.arc(x, Y - 12, 17, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); };
    const chevron = (x, dir) => { g.strokeStyle = ink; g.lineWidth = 9; g.beginPath(); g.moveTo(x - 14 * dir, Y - 16); g.lineTo(x + 12 * dir, Y); g.lineTo(x - 14 * dir, Y + 16); g.stroke(); };
    const smile = (w = 22, open = false) => {
      if (open) { g.fillStyle = '#5a1730'; g.beginPath(); g.moveTo(256 - w, Y + 34); g.quadraticCurveTo(256, Y + 34 + w * 1.6, 256 + w, Y + 34); g.closePath(); g.fill(); g.fillStyle = '#ff7f9b'; g.beginPath(); g.ellipse(256, Y + 34 + w * 0.6, w * 0.55, w * 0.3, 0, 0, Math.PI * 2); g.fill(); }
      else { g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(256 - w, Y + 36); g.quadraticCurveTo(256 - w / 2, Y + 48, 256, Y + 38); g.quadraticCurveTo(256 + w / 2, Y + 48, 256 + w, Y + 36); g.stroke(); }
    };
    const heart = (x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.4, y, x - s * 0.6, y - s, x, y - s * 0.3); g.bezierCurveTo(x + s * 0.6, y - s, x + s * 1.4, y, x, y + s * 0.9); g.fill(); };
    const star = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    switch (n) {
      case 'normal': eye(L); eye(R); smile(18); break;
      case 'happy': arcEye(L); arcEye(R); smile(24, true); break;
      case 'joy': arcEye(L); arcEye(R); smile(30, true); star(L - 70, Y - 40, 14, '#ffd84d'); star(R + 70, Y - 40, 14, '#ffd84d'); break;
      case 'wink': eye(L); chevron(R, -1); smile(22, true); break;
      case 'sparkle': eye(L, 1.25); eye(R, 1.25); star(L - 5, Y - 8, 9, '#fff'); star(R - 5, Y - 8, 9, '#fff'); smile(16); break;
      case 'cool': g.strokeStyle = ink; g.lineWidth = 10; g.beginPath(); g.moveTo(L - 20, Y + 2); g.lineTo(L + 18, Y + 2); g.moveTo(R - 18, Y + 2); g.lineTo(R + 20, Y + 2); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(240, Y + 42); g.quadraticCurveTo(262, Y + 48, 278, Y + 34); g.stroke(); break;
      case 'heart': heart(L, Y, 24, '#ff3d7f'); heart(R, Y, 24, '#ff3d7f'); smile(20, true); break;
      case 'sleepy': arcEye(L, false); arcEye(R, false); g.fillStyle = ink; g.beginPath(); g.ellipse(256, Y + 42, 7, 9, 0, 0, Math.PI * 2); g.fill(); break;
      case 'determined': eye(L); eye(R); g.strokeStyle = ink; g.lineWidth = 8; g.beginPath(); g.moveTo(L - 22, Y - 42); g.lineTo(L + 16, Y - 30); g.moveTo(R + 22, Y - 42); g.lineTo(R - 16, Y - 30); g.stroke(); smile(16); break;
      case 'squash': chevron(L, 1); chevron(R, -1); g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); for (let i = 0; i <= 6; i++) g.lineTo(226 + i * 10, Y + 40 + (i % 2 ? 8 : -2)); g.stroke(); break;
      case 'dizzy': for (const x of [L, R]) { g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.2) g.lineTo(x + Math.cos(a) * a * 1.4, Y + Math.sin(a) * a * 1.4); g.stroke(); } g.fillStyle = '#5a1730'; g.beginPath(); g.ellipse(256, Y + 42, 12, 9, 0, 0, Math.PI * 2); g.fill(); break;
      case 'surprise': eye(L, 1.35); eye(R, 1.35); g.fillStyle = '#5a1730'; g.beginPath(); g.ellipse(256, Y + 48, 13, 17, 0, 0, Math.PI * 2); g.fill(); break;
      case 'oops': eye(L, 0.9); chevron(R, -1); g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(236, Y + 44); g.lineTo(276, Y + 40); g.stroke(); g.fillStyle = '#7fd3ff'; g.beginPath(); g.ellipse(R + 58, Y - 28, 9, 14, 0.3, 0, Math.PI * 2); g.fill(); break;
    }
  },
};
// --- body patterns ---
const PATTERNS = {
  list: { none: '없음', dots: '물방울', stripes: '줄무늬', stars: '별무늬', hearts: '하트무늬', swirl: '소용돌이' },
  price: { none: 0, dots: 60, stripes: 60, stars: 90, hearts: 90, swirl: 120 },
  tex: {},
  init() {
    for (const n of Object.keys(this.list)) {
      if (n === 'none') continue;
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128); g.fillStyle = 'rgba(255,255,255,1)';
      const tint = '#d8d8e8';
      if (n === 'dots') { g.fillStyle = tint; for (let y = 10; y < 128; y += 26) for (let x = (y / 26 % 2) * 16 + 8; x < 256; x += 32) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); } }
      if (n === 'stripes') { g.fillStyle = tint; for (let y = 0; y < 128; y += 22) g.fillRect(0, y, 256, 9); }
      if (n === 'stars' || n === 'hearts') { g.fillStyle = tint; g.font = '22px sans-serif'; for (let y = 16; y < 128; y += 30) for (let x = (y / 30 % 2) * 20 + 10; x < 256; x += 40) { g.save(); g.translate(x, y); if (n === 'stars') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4 : 9; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); } else { g.beginPath(); g.moveTo(0, 7); g.bezierCurveTo(-11, 0, -5, -8, 0, -3); g.bezierCurveTo(5, -8, 11, 0, 0, 7); g.fill(); } g.restore(); } }
      if (n === 'swirl') { g.strokeStyle = tint; g.lineWidth = 7; for (let k = -128; k < 256 + 128; k += 30) { g.beginPath(); for (let y = 0; y <= 128; y += 4) g.lineTo(k + Math.sin(y / 12) * 10 + y * 0.6, y); g.stroke(); } }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; this.tex[n] = t;
    }
  },
};

// --- shop items (cosmetic only) ---
const ITEMS = {
  hat: { label: '모자', items: { none: ['없음', 0], crown: ['젤리 왕관', 150], beanie: ['뜨개 비니', 60], party: ['파티 고깔', 50], flower: ['꽃핀', 40], wizard: ['별빛 마법모자', 120], cap: ['캡 모자', 70], headphone: ['헤드폰', 90] } },
  glasses: { label: '안경', items: { none: ['없음', 0], round: ['동그란 안경', 50], sun: ['선글라스', 70], heart: ['하트 안경', 80], star: ['별 안경', 80] } },
  outfit: { label: '의상', items: { none: ['없음', 0], bowtie: ['리본 넥타이', 40], scarf: ['줄무늬 목도리', 60], cape: ['영웅 망토', 110], medal: ['금메달', 100] } },
  wings: { label: '날개', items: { none: ['없음', 0], angel: ['구름 날개', 120], butterfly: ['나비 날개', 130], jelly: ['젤리 지느러미', 90] } },
  bag: { label: '가방', items: { none: ['없음', 0], backpack: ['작은 백팩', 60], star: ['별 가방', 80], rocket: ['장난감 로켓', 150] } },
  shoes: { label: '신발', items: { none: ['없음', 0], sneakers: ['운동화', 50], boots: ['장화', 60], roller: ['롤러 신발', 110] } },
  trail: { label: '이동 효과', items: { none: ['없음', 0], stars: ['별가루', 80], hearts: ['하트 퐁퐁', 80], bubbles: ['비눗방울', 90], rainbow: ['무지개', 160], numbers: ['숫자 에너지', 140] } },
};
function itemPrice(cat, id) {
  if (cat === 'costume') return COSTUMES[id].price;
  if (cat === 'color') return COLORS[id].price; if (cat === 'pattern') return PATTERNS.price[id]; if (cat === 'face') return FACES.price[id];
  return ITEMS[cat].items[id][1];
}
function itemName(cat, id) {
  if (cat === 'costume') return COSTUMES[id].name;
  if (cat === 'color') return COLORS[id].name; if (cat === 'pattern') return PATTERNS.list[id]; if (cat === 'face') return FACES.list[id];
  return ITEMS[cat].items[id][0];
}

const _mats = {};
function mat(hex, opts = {}) {
  const key = hex + JSON.stringify(opts); if (_mats[key]) return _mats[key];
  return (_mats[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.72, metalness: 0, envMapIntensity: 0.5 }, opts)));
}
function jellyMaterial(hex, pattern) {
  const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), emissive: new THREE.Color(hex).multiplyScalar(0.07), envMapIntensity: 0.8 });
  if (pattern && pattern !== 'none' && PATTERNS.tex[pattern]) { m.map = PATTERNS.tex[pattern]; }
  return m;
}

// --- accessories (in body-local units: body ~2.2 wide, ~1.75 tall, front is +z) ---
function buildAccessory(cat, id, color) {
  const g = new THREE.Group(); const M = mat;
  const add = (geo, m, pos, scl, rot) => { const o = new THREE.Mesh(geo, m); if (pos) o.position.set(...pos); if (scl) o.scale.set(...scl); if (rot) o.rotation.set(...rot); g.add(o); return o; };
  if (cat === 'hat') {
    if (id === 'crown') { add(GEO.cyl, M(0xffd23f, { metalness: 0.4, roughness: 0.3 }), [0, 1.62, 0], [0.48, 0.3, 0.48]); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(GEO.cone, M(0xffd23f, { metalness: 0.4, roughness: 0.3 }), [Math.cos(a) * 0.4, 1.9, Math.sin(a) * 0.4], [0.13, 0.32, 0.13]); add(GEO.sphere, M(0xff5fa2), [Math.cos(a) * 0.4, 2.08, Math.sin(a) * 0.4], [0.07, 0.07, 0.07]); } }
    if (id === 'beanie') { add(GEO.sphere, M(0x6fb8ff), [0, 1.5, 0], [0.72, 0.5, 0.72]); add(GEO.torus, M(0xffffff), [0, 1.42, 0], [0.7, 0.7, 0.9], [Math.PI / 2, 0, 0]); add(GEO.sphere, M(0xffffff), [0, 2.0, 0], [0.2, 0.2, 0.2]); }
    if (id === 'party') { add(GEO.cone, M(0xff8ad8), [0.15, 2.0, 0], [0.32, 0.8, 0.32], [0, 0, -0.25]); add(GEO.sphere, M(0xffe14d), [0.36, 2.42, 0], [0.12, 0.12, 0.12]); }
    if (id === 'flower') { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(GEO.sphere, M(0xff9ccf), [0.55 + Math.cos(a) * 0.14, 1.38 + Math.sin(a) * 0.14, 0.45], [0.12, 0.12, 0.06]); } add(GEO.sphere, M(0xffe14d), [0.55, 1.38, 0.48], [0.08, 0.08, 0.06]); }
    if (id === 'wizard') { add(GEO.cyl, M(0x5a4cff), [0, 1.5, 0], [0.95, 0.06, 0.95]); add(GEO.cone, M(0x5a4cff), [0, 2.05, -0.05], [0.55, 1.1, 0.55], [-0.2, 0, 0]); add(GEO.star, M(0xffe14d, { emissive: 0x806000 }), [0, 2.05, 0.35], [0.12, 0.12, 0.12]); }
    if (id === 'cap') { add(GEO.sphere, M(0xff5a5a), [0, 1.48, 0], [0.7, 0.42, 0.7]); add(GEO.cyl, M(0xff5a5a), [0, 1.42, 0.6], [0.45, 0.04, 0.4]); }
    if (id === 'headphone') { add(GEO.torus, M(0x3a3a55), [0, 1.2, 0], [0.9, 0.9, 0.9], [0, Math.PI / 2, 0]).scale.set(0.95, 0.75, 0.5); add(GEO.cyl, M(0xff7eb6), [0.93, 0.95, 0], [0.22, 0.14, 0.22], [0, 0, Math.PI / 2]); add(GEO.cyl, M(0xff7eb6), [-0.93, 0.95, 0], [0.22, 0.14, 0.22], [0, 0, Math.PI / 2]); }
  }
  if (cat === 'glasses') {
    const z = 1.0, y = 0.84;
    if (id === 'round') { for (const x of [-0.33, 0.33]) add(GEO.torus, M(0x3a2a20), [x, y, z], [0.2, 0.2, 0.2]); add(GEO.box, M(0x3a2a20), [0, y, z + 0.02], [0.22, 0.04, 0.04]); }
    if (id === 'sun') { for (const x of [-0.33, 0.33]) add(GEO.cyl, M(0x111122, { roughness: 0.1, metalness: 0.3 }), [x, y, z], [0.24, 0.05, 0.18], [Math.PI / 2, 0, 0]); add(GEO.box, M(0x111122), [0, y + 0.05, z], [0.4, 0.05, 0.05]); }
    if (id === 'heart') { for (const x of [-0.33, 0.33]) { const h = add(GEO.sphere, M(0xff3d7f, { transparent: true, opacity: 0.85 }), [x, y, z], [0.22, 0.19, 0.06]); } add(GEO.box, M(0xff3d7f), [0, y, z], [0.25, 0.04, 0.04]); }
    if (id === 'star') { for (const x of [-0.34, 0.34]) add(GEO.star, M(0xffd23f), [x, y, z], [0.24, 0.24, 0.12]); }
  }
  if (cat === 'outfit') {
    if (id === 'bowtie') { add(GEO.cone, M(0xff3d7f), [-0.17, 0.42, 0.98], [0.16, 0.24, 0.12], [0, 0, Math.PI / 2]); add(GEO.cone, M(0xff3d7f), [0.17, 0.42, 0.98], [0.16, 0.24, 0.12], [0, 0, -Math.PI / 2]); add(GEO.sphere, M(0xff6fa0), [0, 0.42, 1.0], [0.08, 0.08, 0.08]); }
    if (id === 'scarf') { add(GEO.torus, M(0xff5a5a), [0, 0.45, 0], [1.02, 1.02, 0.9], [Math.PI / 2, 0, 0]); add(GEO.box, M(0x5ad1ff), [0.45, 0.2, 0.85], [0.22, 0.45, 0.08], [0.2, 0, 0.2]); }
    if (id === 'cape') { const c = add(GEO.sphere, M(0xe0304f, { side: THREE.DoubleSide }), [0, 0.7, -0.75], [0.95, 0.7, 0.2]); add(GEO.sphere, M(0xffd23f), [0, 1.05, -0.92], [0.1, 0.1, 0.05]); }
    if (id === 'medal') { add(GEO.torus, M(0x4a7bff), [0, 0.65, 0.6], [0.45, 0.45, 0.3], [-0.5, 0, 0]); add(GEO.cyl, M(0xffd23f, { metalness: 0.5, roughness: 0.3 }), [0, 0.32, 1.02], [0.2, 0.05, 0.2], [Math.PI / 2, 0, 0]); }
  }
  if (cat === 'wings') {
    for (const s of [-1, 1]) {
      if (id === 'angel') { for (let i = 0; i < 3; i++) add(GEO.sphere, M(0xffffff), [s * (0.9 + i * 0.22), 1.0 + i * 0.1, -0.55], [0.3 - i * 0.05, 0.2, 0.08], [0, s * 0.4, 0]); }
      if (id === 'butterfly') { add(GEO.sphere, M(0xffa3e0, { transparent: true, opacity: 0.85 }), [s * 0.85, 1.1, -0.7], [0.55, 0.42, 0.04], [0, s * 0.5, s * 0.4]); add(GEO.sphere, M(0x9be3ff, { transparent: true, opacity: 0.85 }), [s * 0.7, 0.6, -0.7], [0.35, 0.3, 0.04], [0, s * 0.5, -s * 0.3]); }
      if (id === 'jelly') { add(GEO.cone, M(color, { transparent: true, opacity: 0.8 }), [s * 1.1, 0.6, -0.1], [0.25, 0.6, 0.12], [0, 0, -s * 1.9]); }
    }
  }
  if (cat === 'bag') {
    if (id === 'backpack') { add(GEO.box, M(0xffb347), [0, 0.65, -1.0], [0.75, 0.65, 0.3]); add(GEO.box, M(0xff8f1f), [0, 0.5, -1.17], [0.5, 0.3, 0.06]); }
    if (id === 'star') { add(GEO.star, M(0xffd23f), [0, 0.7, -1.02], [0.45, 0.45, 0.35]); }
    if (id === 'rocket') { add(GEO.cyl, M(0xf0f0ff), [0, 0.8, -1.05], [0.22, 0.9, 0.22]); add(GEO.cone, M(0xff3d5a), [0, 1.4, -1.05], [0.22, 0.32, 0.22]); for (const s of [-1, 1]) add(GEO.cone, M(0xff3d5a), [s * 0.24, 0.42, -1.05], [0.1, 0.3, 0.1]); }
  }
  if (cat === 'shoes') {
    for (const s of [-1, 1]) {
      if (id === 'sneakers') { add(GEO.sphere, M(0xffffff), [s * 0.45, 0.08, 0.35], [0.28, 0.13, 0.4]); add(GEO.box, M(0xff3d7f), [s * 0.45, 0.13, 0.42], [0.3, 0.05, 0.25]); }
      if (id === 'boots') { add(GEO.cyl, M(0xffd23f), [s * 0.45, 0.16, 0.3], [0.26, 0.32, 0.26]); add(GEO.sphere, M(0xffd23f), [s * 0.45, 0.06, 0.48], [0.25, 0.1, 0.25]); }
      if (id === 'roller') { add(GEO.sphere, M(0x9b7bff), [s * 0.45, 0.14, 0.35], [0.28, 0.13, 0.4]); for (const z of [0.1, 0.6]) add(GEO.cyl, M(0x333344), [s * 0.45, 0.02, z], [0.08, 0.2, 0.08], [0, 0, Math.PI / 2]); }
    }
  }
  return g;
}
// podium crown worn in the next race by last race's top 3
const CROWN_TIERS = { gold: [0xffd23f, '금'], silver: [0xd8dee9, '은'], bronze: [0xd08a4e, '동'] };
function buildCrown(tier) {
  const g = new THREE.Group(), c = CROWN_TIERS[tier][0], M = mat(c, { metalness: 0.75, roughness: 0.22 });
  const add = (geo, m, pos, scl) => { const o = new THREE.Mesh(geo, m); o.position.set(...pos); o.scale.set(...scl); o.castShadow = true; g.add(o); };
  add(GEO.cyl, M, [0, 1.6, 0], [0.5, 0.3, 0.5]);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; add(GEO.cone, M, [Math.cos(a) * 0.42, 1.9, Math.sin(a) * 0.42], [0.13, 0.36, 0.13]); add(GEO.sphere, mat(tier === 'gold' ? 0xff4f8a : tier === 'silver' ? 0x5cc8ff : 0x5fe0b0, { emissive: 0x331122 }), [Math.cos(a) * 0.42, 2.1, Math.sin(a) * 0.42], [0.075, 0.075, 0.075]); }
  return g;
}
// ---------- transformation costumes (zodiac animals, fried egg, squishy-toy shapes) ----------
const COSTUMES = {
  none: { name: '없음', price: 0, icon: '⚪' },
  rat: { name: '쥐', price: 120, icon: '🐭', color: 0xb9bcc8 }, ox: { name: '소', price: 120, icon: '🐮', color: 0xc9925e }, tiger: { name: '호랑이', price: 150, icon: '🐯', color: 0xffa23a },
  rabbit: { name: '토끼', price: 120, icon: '🐰', color: 0xfff6f2 }, dragon: { name: '용', price: 180, icon: '🐲', color: 0x4fcf8a }, snake: { name: '뱀', price: 120, icon: '🐍', color: 0xa4dc4e },
  horse: { name: '말', price: 120, icon: '🐴', color: 0xb9774a }, sheep: { name: '양', price: 130, icon: '🐑', color: 0xfff3e0 }, monkey: { name: '원숭이', price: 130, icon: '🐵', color: 0xa9744f },
  rooster: { name: '닭', price: 130, icon: '🐔', color: 0xfffaf0 }, dog: { name: '개', price: 120, icon: '🐶', color: 0xe6b77e }, pig: { name: '돼지', price: 120, icon: '🐷', color: 0xffa9c0 },
  egg: { name: '계란후라이', price: 160, icon: '🍳', color: 0xffc21f }, pudding: { name: '푸딩 말랑이', price: 140, icon: '🍮', color: 0xffe08a }, mochi: { name: '찹쌀떡 말랑이', price: 140, icon: '🍡', color: 0xfffbf5 },
  dumpling: { name: '만두 말랑이', price: 140, icon: '🥟', color: 0xfff0d6 }, toast: { name: '식빵 말랑이', price: 140, icon: '🍞', color: 0xf5d7a1 }, slime: { name: '반짝 슬라임', price: 170, icon: '🫧', color: 0x7ff0d0 },
};
function buildCostume(id, color) {
  const g = new THREE.Group(), M = mat, J = jellyMaterial;
  const add = (geo, m, pos, scl, rot) => { const o = new THREE.Mesh(geo, m); o.position.set(...pos); o.scale.set(...scl); if (rot) o.rotation.set(...rot); o.castShadow = true; g.add(o); return o; };
  const ears = (x, y, sx, sy, col, inner, rz = 0.3) => { for (const s of [-1, 1]) { add(GEO.sphere, J(col), [s * x, y, 0], [sx, sy, 0.14], [0, 0, -s * rz]); if (inner) add(GEO.sphere, M(inner), [s * x, y, 0.09], [sx * 0.6, sy * 0.6, 0.08], [0, 0, -s * rz]); } };
  const tail = (col, len = 0.7) => add(GEO.cyl, M(col), [0, 0.35, -1.25], [0.06, len, 0.06], [-1.1, 0, 0]);
  switch (id) {
    case 'rat': ears(0.78, 1.5, 0.42, 0.42, color, 0xffb3c7, 0.2); tail(0xffb3c7, 0.9); add(GEO.sphere, M(0xff8fa8), [0, 0.74, 1.06], [0.08, 0.06, 0.06]); break;
    case 'ox': for (const s of [-1, 1]) { add(GEO.cone, M(0xfff6e0), [s * 0.62, 1.72, 0], [0.13, 0.5, 0.13], [0, 0, -s * 0.5]); add(GEO.sphere, J(color), [s * 1.0, 1.2, 0], [0.26, 0.15, 0.1], [0, 0, -s * 0.2]); } add(GEO.sphere, M(0xffd9c2), [0, 0.6, 0.98], [0.4, 0.24, 0.16]); add(GEO.torus, M(0xffd23f, { metalness: 0.7, roughness: 0.25 }), [0, 0.5, 1.13], [0.1, 0.1, 0.1]); break;
    case 'tiger': ears(0.7, 1.52, 0.3, 0.3, color, 0xffffff, 0.2); for (const [x, y, r] of [[0, 1.5, 0], [-0.3, 1.42, 0.5], [0.3, 1.42, -0.5]]) add(GEO.box, M(0x3a2a20), [x, y, 0.62], [0.09, 0.3, 0.3], [-0.9, 0, r]); for (const s of [-1, 1]) for (const y of [0.55, 0.85]) add(GEO.box, M(0x3a2a20), [s * 1.06, y, 0.2], [0.1, 0.07, 0.4], [0, 0, 0]); tail(color, 0.9); break;
    case 'rabbit': for (const s of [-1, 1]) { add(GEO.sphere, J(color), [s * 0.36, 2.15, 0], [0.19, 0.68, 0.12], [0, 0, -s * 0.12]); add(GEO.sphere, M(0xffb3c7), [s * 0.36, 2.15, 0.08], [0.1, 0.5, 0.07], [0, 0, -s * 0.12]); } add(GEO.sphere, M(0xffffff), [0, 0.4, -1.1], [0.24, 0.24, 0.24]); break;
    case 'dragon': for (const s of [-1, 1]) { add(GEO.cone, M(0xffe17a), [s * 0.45, 1.85, 0], [0.11, 0.5, 0.11], [0, 0, -s * 0.35]); add(GEO.cone, M(0xff7a5a, { side: THREE.DoubleSide }), [s * 1.15, 1.0, -0.3], [0.4, 0.6, 0.06], [0, 0, -s * 1.3]); } for (let i = 0; i < 5; i++) add(GEO.cone, M(0xffb02e), [0, 1.62 - i * 0.26, -0.35 - i * 0.2], [0.14, 0.3, 0.14], [-0.6 - i * 0.2, 0, 0]); for (const s of [-1, 1]) add(GEO.cyl, M(0xffe17a), [s * 0.55, 0.6, 1.0], [0.02, 0.5, 0.02], [0, 0, s * 1.0]); break;
    case 'snake': add(GEO.box, M(0xff3d5a), [0, 0.55, 1.15], [0.07, 0.03, 0.3]); for (const s of [-1, 1]) add(GEO.box, M(0xff3d5a), [s * 0.06, 0.55, 1.32], [0.05, 0.03, 0.12], [0, s * 0.5, 0]); for (let i = 0; i < 4; i++) add(GEO.sphere, M(0x5fae2e), [0, 1.5 - i * 0.3, -0.55 - i * 0.16], [0.16, 0.1, 0.1]); add(GEO.cone, J(color), [0, 0.25, -1.3], [0.2, 0.7, 0.2], [-1.4, 0, 0]); break;
    case 'horse': for (const s of [-1, 1]) add(GEO.cone, J(color), [s * 0.5, 1.75, 0], [0.16, 0.4, 0.1], [0, 0, -s * 0.2]); for (let i = 0; i < 6; i++) add(GEO.sphere, M(0x5a3520), [0, 1.72 - i * 0.2, 0.25 - i * 0.24], [0.16, 0.2, 0.2]); add(GEO.sphere, M(0x5a3520), [0, 0.5, -1.15], [0.14, 0.4, 0.14]); add(GEO.sphere, M(0xffe9d6), [0, 0.6, 0.98], [0.36, 0.22, 0.15]); break;
    case 'sheep': for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(GEO.sphere, M(0xffffff, { roughness: 0.95 }), [Math.cos(a) * 0.55, 1.5 + (i % 2) * 0.1, Math.sin(a) * 0.5 - 0.1], [0.3, 0.26, 0.3]); } add(GEO.sphere, M(0xffffff, { roughness: 0.95 }), [0, 1.75, -0.1], [0.36, 0.28, 0.36]); for (const s of [-1, 1]) add(GEO.sphere, M(0x6b5648), [s * 0.98, 1.15, 0.1], [0.22, 0.12, 0.1], [0, 0, s * 0.5]); break;
    case 'monkey': for (const s of [-1, 1]) { add(GEO.sphere, J(color), [s * 1.08, 1.0, 0], [0.3, 0.3, 0.12]); add(GEO.sphere, M(0xffd9b8), [s * 1.1, 1.0, 0.08], [0.18, 0.18, 0.08]); } add(GEO.torus, J(color), [0, 0.6, -1.2], [0.25, 0.25, 0.3], [0, Math.PI / 2, 0]); break;
    case 'rooster': for (let i = 0; i < 3; i++) add(GEO.sphere, M(0xff3d4f), [0, 1.78 - Math.abs(i - 1) * 0.08, 0.25 - i * 0.25], [0.13, 0.22, 0.16]); add(GEO.cone, M(0xffb02e), [0, 0.68, 1.12], [0.12, 0.26, 0.12], [Math.PI / 2, 0, 0]); add(GEO.sphere, M(0xff3d4f), [0, 0.46, 1.04], [0.08, 0.13, 0.06]); for (let i = -1; i <= 1; i++) add(GEO.sphere, M(i ? 0x3fc2ff : 0xff9a3c), [i * 0.2, 0.75, -1.1], [0.1, 0.5, 0.1], [-0.7, 0, i * 0.3]); break;
    case 'dog': for (const s of [-1, 1]) add(GEO.sphere, M(0x9a6238), [s * 0.9, 1.15, 0.15], [0.24, 0.5, 0.13], [0, 0, s * 0.25]); add(GEO.sphere, M(0x33221a), [0, 0.75, 1.07], [0.1, 0.07, 0.07]); add(GEO.sphere, M(0xff6f8f), [0, 0.42, 1.05], [0.1, 0.15, 0.04]); add(GEO.cone, J(color), [0, 0.6, -1.15], [0.12, 0.5, 0.12], [-0.6, 0, 0]); break;
    case 'pig': add(GEO.cyl, M(0xff8fae), [0, 0.68, 1.04], [0.24, 0.14, 0.18], [Math.PI / 2, 0, 0]); for (const s of [-1, 1]) { add(GEO.sphere, M(0xc9506f), [s * 0.09, 0.68, 1.12], [0.04, 0.06, 0.03]); add(GEO.cone, J(color), [s * 0.62, 1.6, 0.1], [0.24, 0.32, 0.1], [0.3, 0, -s * 0.5]); } add(GEO.torus, M(0xff8fae), [0, 0.5, -1.15], [0.12, 0.12, 0.2], [0, Math.PI / 2, 0]); break;
    case 'egg': { const w = M(0xffffff, { roughness: 0.35 }); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(GEO.sphere, w, [Math.cos(a) * 1.05, 0.08, Math.sin(a) * 1.05], [0.6 + (i % 3) * 0.14, 0.1, 0.6 + ((i + 1) % 3) * 0.12]); } add(GEO.cyl, w, [0, 0.06, 0], [1.25, 0.1, 1.25]); add(GEO.sphere, M(0xffffff, { transparent: true, opacity: 0.7 }), [-0.4, 1.3, 0.55], [0.22, 0.12, 0.1], [0, 0, 0.5]); break; }
    case 'pudding': add(GEO.sphere, M(0x9a531f, { roughness: 0.15 }), [0, 1.42, 0], [0.62, 0.28, 0.6]); for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; add(GEO.sphere, M(0x9a531f, { roughness: 0.15 }), [Math.cos(a) * 0.55, 1.22, Math.sin(a) * 0.52], [0.14, 0.3, 0.14]); } add(GEO.sphere, M(0xffffff), [0, 1.74, 0], [0.22, 0.18, 0.22]); add(GEO.sphere, M(0xff3d4f, { roughness: 0.2 }), [0, 1.95, 0], [0.13, 0.13, 0.13]); add(GEO.cyl, M(0xffffff), [0, 0.04, 0], [1.4, 0.06, 1.4]); break;
    case 'mochi': for (let i = 0; i < 14; i++) { const a = rand(0, 6.28), y = rand(1.1, 1.6); const r = 0.75 - (y - 1.1) * 0.9; add(GEO.sphere, M(0xffffff, { roughness: 1 }), [Math.cos(a) * r, y, Math.sin(a) * r], [0.07, 0.04, 0.07]); } add(GEO.sphere, M(0xffb3c7, { transparent: true, opacity: 0.6 }), [0, 0.5, 0], [1.12, 0.3, 1.08]); add(GEO.leaf, M(0x7fcf6b), [0, 0.03, 0], [2.6, 0.5, 1.5]); break;
    case 'dumpling': for (let i = 0; i < 7; i++) { const u = (i - 3) / 3; add(GEO.sphere, J(color), [u * 0.55, 1.68 - Math.abs(u) * 0.22, 0], [0.13, 0.2, 0.3], [0, 0, -u * 0.6]); } add(GEO.cyl, M(0xc98f5a), [0, 0.04, 0], [1.4, 0.06, 1.4]); break;
    case 'toast': add(GEO.torus, M(0xb9743a, { roughness: 0.8 }), [0, 0.22, 0], [1.1, 1.06, 0.7], [Math.PI / 2, 0, 0]); add(GEO.box, M(0xffe17a, { roughness: 0.3 }), [0.1, 1.6, 0.1], [0.42, 0.12, 0.42], [0.1, 0.5, 0.15]); break;
    case 'slime': for (let i = 0; i < 10; i++) { const a = rand(0, 6.28), y = rand(0.3, 1.4), r = 1.08 - Math.max(0, y - 0.6) * 0.5; add(GEO.star, M(pick([0xffffff, 0xfff38a, 0xff9ccf]), { emissive: 0x555533 }), [Math.cos(a) * r, y, Math.sin(a) * r], [0.08, 0.08, 0.05], [0, -a + Math.PI / 2, 0]); } for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; add(GEO.sphere, J(color), [Math.cos(a) * 1.05, 0.08, Math.sin(a) * 1.05], [0.35, 0.1, 0.35]); } break;
  }
  return g;
}
// tuft on top: grows with math level (sprout -> two leaves -> flower -> star)
function buildTuft(kind, color) {
  const g = new THREE.Group(); const leafM = mat(0x5ed16b, { roughness: 0.5 });
  const add = (geo, m, pos, scl, rot) => { const o = new THREE.Mesh(geo, m); o.position.set(...pos); o.scale.set(...scl); if (rot) o.rotation.set(...rot); g.add(o); return o; };
  const top = 1.78;
  if (kind === 'sprout' || kind === 'leaf2' || kind === 'flower') {
    add(GEO.cyl, leafM, [0, top + 0.08, 0], [0.04, 0.22, 0.04]);
    add(GEO.leaf, leafM, [-0.2, top + 0.2, 0], [0.32, 0.6, 0.28], [0, 0, 0.5]).rotation.y = Math.PI / 2;
    add(GEO.leaf, leafM, [0.2, top + 0.2, 0], [0.32, 0.6, 0.28], [0, 0, -0.5]).rotation.y = Math.PI / 2;
    if (kind !== 'sprout') { add(GEO.leaf, leafM, [0, top + 0.25, -0.2], [0.3, 0.6, 0.26], [0.5, 0, 0]); }
    if (kind === 'flower') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(GEO.sphere, mat(0xffffff), [Math.cos(a) * 0.15, top + 0.4, Math.sin(a) * 0.15], [0.11, 0.06, 0.11]); } add(GEO.sphere, mat(0xffd23f), [0, top + 0.42, 0], [0.09, 0.07, 0.09]); }
  } else if (kind === 'star') {
    add(GEO.star, mat(0xffe14d, { emissive: 0x997700, roughness: 0.3 }), [0, top + 0.28, 0], [0.24, 0.24, 0.24]);
  } else if (kind === 'curl') {
    add(GEO.torus, jellyMaterial(color), [0, top + 0.1, 0], [0.16, 0.16, 0.2], [0, Math.PI / 2, 0]);
  } else if (kind === 'ears') {
    for (const s of [-1, 1]) add(GEO.sphere, jellyMaterial(color), [s * 0.5, 1.55, 0], [0.22, 0.3, 0.2], [0, 0, -s * 0.4]);
  } else if (kind === 'antenna') {
    add(GEO.cyl, mat(0x444455), [0, top + 0.15, 0], [0.025, 0.35, 0.025]); add(GEO.sphere, mat(0xff5fa2, { emissive: 0x661030 }), [0, top + 0.35, 0], [0.1, 0.1, 0.1]);
  }
  return g;
}
const TUFT_BY_LEVEL = [null, 'sprout', 'leaf2', 'leaf2', 'flower', 'flower', 'star'];

// ---------------- MallangView ----------------
class MallangView {
  constructor(look, hi = true) {
    this.root = new THREE.Group(); this.yaw = new THREE.Group(); this.squash = new THREE.Group(); this.lean = new THREE.Group();
    this.root.add(this.yaw); this.yaw.add(this.lean); this.lean.add(this.squash);
    this.look = look; this.hi = hi;
    this.bodyMat = jellyMaterial(look.colorHex, look.pattern); if (look.costume === 'slime') { this.bodyMat.transparent = true; this.bodyMat.opacity = 0.82; }
    this.body = new THREE.Mesh(hi ? GEO.bodyHi : GEO.bodyLo, this.bodyMat); this.body.castShadow = true; this.squash.add(this.body);
    this.face = new THREE.Mesh(GEO.face, FACES.mats[look.face || 'normal']); this.squash.add(this.face);
    this.baseFace = look.face || 'normal'; this.curFace = this.baseFace; this.faceTimer = 0;
    this.arms = [-1, 1].map((sd) => { const a = new THREE.Mesh(GEO.sphereLo, this.bodyMat); a.scale.set(0.17, 0.26, 0.17); a.position.set(sd * 1.08, 0.58, 0.08); a.rotation.z = sd * 0.5; a.castShadow = true; this.squash.add(a); return a; });
    this.extras = new THREE.Group(); this.squash.add(this.extras);
    this.buildExtras();
    // squash & stretch springs
    this.sy = 1; this.vy = 0; this.wob = 0; this.wobV = 0; this.flatT = 0; this.flatDur = 0.55; this.t = Math.random() * 10;
    this.leanX = 0; this.leanZ = 0;
    this.root.scale.setScalar(look.scale || 0.62);
    this.lean.scale.set(0.9, 1.12, 0.9);
  }
  // thick bright outline so my mallang stands out from the floor
  setOutline(on) {
    if (!on) { if (this.outline) this.outline.visible = false; return; }
    if (!this.outline) { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }); this.outline = new THREE.Mesh(this.body.geometry, m); this.outline.scale.setScalar(1.07); this.squash.add(this.outline);
      const m2 = new THREE.MeshBasicMaterial({ color: 0xffd84d, side: THREE.BackSide }); const o2 = new THREE.Mesh(this.body.geometry, m2); o2.scale.setScalar(1.2); this.outline.add(o2); o2.scale.setScalar(1.04); }
    this.outline.visible = true;
  }
  buildExtras() {
    this.extras.clear(); const L = this.look;
    const cs = L.costume && L.costume !== 'none';
    if (L.crown) this.extras.add(buildCrown(L.crown));
    else if (L.tuft && !cs && (!L.hat || L.hat === 'none')) this.extras.add(buildTuft(L.tuft, L.colorHex));
    if (cs) this.extras.add(buildCostume(L.costume, L.colorHex));
    for (const cat of ['hat', 'glasses', 'outfit', 'wings', 'bag', 'shoes']) if (cat === 'hat' && L.crown) continue; else if (L[cat] && L[cat] !== 'none') this.extras.add(buildAccessory(cat, L[cat], L.colorHex));
  }
  setLook(look) {
    this.look = look; this.bodyMat.color.setHex(look.colorHex); this.bodyMat.emissive.setHex(look.colorHex).multiplyScalar(0.07);
    this.bodyMat.map = look.pattern && look.pattern !== 'none' ? PATTERNS.tex[look.pattern] : null; this.bodyMat.needsUpdate = true;
    this.bodyMat.transparent = look.costume === 'slime'; this.bodyMat.opacity = look.costume === 'slime' ? 0.82 : 1; this.baseFace = look.face || 'normal'; this.setFace(this.baseFace); this.buildExtras();
  }
  setFace(n, dur = 0) { if (this.curFace !== n) { this.curFace = n; this.face.material = FACES.mats[n] || FACES.mats.normal; } this.faceTimer = dur; }
  setDetail(near) { if (this._near === near) return; this._near = near; this.face.visible = near; this.extras.visible = near; this.body.geometry = near && this.hi ? GEO.bodyHi : GEO.bodyLo; }
  // impulses
  stretch(a = 0.35) { this.sy = 1 + a; this.vy = 2; }
  land(a = 0.35) { this.vy -= a * 14; }
  bump(a = 1) { this.wobV += a * 9 * (Math.random() < 0.5 ? -1 : 1); this.vy -= 3 * a; }
  flatten(dur = 0.55) { this.flatT = dur; this.flatDur = dur; this.sy = 0.32; this.vy = 0; this.setFace('squash', dur + 0.25); }
  update(dt, speed01, grounded, moving) {
    this.t += dt;
    if (this.faceTimer > 0) { this.faceTimer -= dt; if (this.faceTimer <= 0) this.setFace(this.baseFace); }
    let sy;
    if (this.flatT > 0) {
      this.flatT -= dt; const k = this.flatT / this.flatDur; // hold flat, slight jiggle
      sy = 0.32 + 0.04 * Math.sin(this.t * 40) * k;
      this.sy = sy; this.vy = 0;
      if (this.flatT <= 0) { this.vy = 9; this.wobV += 8; } // pop back up with overshoot
    } else {
      // spring towards rest (+ idle/run bounce)
      let rest = 1;
      if (grounded) rest += moving ? Math.sin(this.t * 16) * 0.07 * speed01 : Math.sin(this.t * 3.2) * 0.035;
      const a = -170 * (this.sy - rest) - 9 * this.vy; this.vy += a * dt; this.sy += this.vy * dt; this.sy = clamp(this.sy, 0.3, 1.6);
      sy = this.sy;
    }
    const sx = 1 / Math.sqrt(sy);
    const flatWide = this.flatT > 0 ? 1.05 : 1;
    this.squash.scale.set(sx * flatWide, sy, sx * flatWide);
    // side wobble spring
    const wa = -120 * this.wob - 7 * this.wobV; this.wobV += wa * dt; this.wob += this.wobV * dt;
    const runSway = grounded && moving ? Math.sin(this.t * 8) * 0.09 * speed01 : 0;
    this.squash.rotation.z = this.wob * 0.12 + runSway;
    this.lean.rotation.x = damp(this.lean.rotation.x, moving ? 0.16 * speed01 : 0, 10, dt);
    if (this.arms) { const sw = moving && grounded ? Math.sin(this.t * 14) * 0.7 * speed01 : grounded ? Math.sin(this.t * 2.4) * 0.12 : -0.9; this.arms[0].rotation.x = sw; this.arms[1].rotation.x = -sw; const up = grounded ? 0 : 0.5; this.arms[0].rotation.z = -0.5 - up; this.arms[1].rotation.z = 0.5 + up; }
  }
}
