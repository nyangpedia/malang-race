// ================================================================
// Race: racers (physics + AI), stomping, gates logic, camera, HUD
// ================================================================
const PHYS = { R: 0.6, G: 30, JUMP: 11.2, SPEED: 8.6, ACC_G: 52, ACC_A: 24, STOMP_BOUNCE: 10.5 };
const AI_TYPES = {
  speedy: { label: '질주형', speed: [1.0, 1.05], acc: [0.75, 0.88], react: [0.6, 1.4], jump: 0.15, caution: 0.2, aggro: 0.1, stomp: 0.15, mistake: 0.05 },
  careful: { label: '신중형', speed: [0.86, 0.93], acc: [0.88, 0.96], react: [1.2, 2.4], jump: 0.05, caution: 1, aggro: 0, stomp: 0.05, mistake: 0.02 },
  jumper: { label: '점프형', speed: [0.9, 0.98], acc: [0.7, 0.85], react: [0.8, 1.8], jump: 1, caution: 0.4, aggro: 0.1, stomp: 0.3, mistake: 0.08 },
  solver: { label: '계산왕', speed: [0.88, 0.95], acc: [0.95, 1.0], react: [0.3, 0.8], jump: 0.1, caution: 0.6, aggro: 0, stomp: 0.05, mistake: 0.03 },
  retry: { label: '재도전형', speed: [0.9, 0.98], acc: [0.35, 0.5], react: [0.4, 1.0], jump: 0.15, caution: 0.4, aggro: 0.1, stomp: 0.1, mistake: 0.05 },
  bumper: { label: '몸통박치기형', speed: [0.92, 1.0], acc: [0.65, 0.85], react: [0.8, 1.8], jump: 0.2, caution: 0.2, aggro: 1, stomp: 0.2, mistake: 0.05 },
  stomper: { label: '밟기 장인', speed: [0.9, 0.98], acc: [0.65, 0.85], react: [0.8, 1.8], jump: 0.4, caution: 0.3, aggro: 0.3, stomp: 1, mistake: 0.05 },
  blunder: { label: '덤벙형', speed: [1.02, 1.08], acc: [0.55, 0.75], react: [0.5, 1.2], jump: 0.3, caution: 0.1, aggro: 0.2, stomp: 0.2, mistake: 0.35 },
};
const AI_NAME_A = ['핑크', '구름', '별빛', '초코', '민트', '레몬', '솜사탕', '젤리', '포도', '복숭아', '무지개', '달콩', '마카롱', '푸딩', '소다', '꿀', '말차', '체리', '바닐라', '코코', '하늘', '보라', '방울', '토토', '모찌', '쿠키', '라떼', '반짝', '팝콘', '사과', '두부', '호두', '오로라', '새벽', '쫀득', '몽글', '뭉게', '통통', '말랑', '보들'];
const TUFTS = ['none', 'curl', 'ears', 'sprout', 'antenna', 'star', 'none', 'curl'];

class Racer {
  constructor(race, idx, opts) {
    this.race = race; this.idx = idx; this.name = opts.name; this.isPlayer = !!opts.isPlayer;
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3(); this.r = PHYS.R;
    this.ground = false; this.gs = null; this.coyote = 0; this.jumpBuf = 0; this.jumpCD = 0; this.stunT = 0; this.flatT = 0; this.stompCD = 0; this.immuneT = 0; this.bounceCD = 0;
    this.respawnT = 0; this.cp = 0; this.finished = false; this.place = 0; this.finishTime = 0; this.lastVy = 0;
    this.in = { x: 0, z: 0, jump: false };
    this.speed = PHYS.SPEED * (opts.speedMul || 1);
    this.view = new MallangView(opts.look, true); race.scene.add(this.view.root);
    this.yaw = Math.PI; this.view.yaw.rotation.y = this.yaw;
    this.ai = opts.ai || null; this.gateResult = {};
    this.trailT = 0; this.color = opts.look.colorHex;
  }
  get d() { return -this.p.z; }
  progress() { return this.finished ? 100000 - this.place : this.respawnT > 0 ? this.race.course.checkpoints[this.cp].d : -this.p.z; }
}

// ---------------- Particles ----------------
class Particles {
  constructor(scene, max = 900) {
    this.max = max; this.n = 0; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grav = new Float32Array(max); this.baseSize = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; float a=smoothstep(0.5,0.2,d); vec3 col=mix(vC, vec3(1.0), smoothstep(0.25,0.0,d)*0.6); gl_FragColor=vec4(col, a*vA); }',
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points); this.geo = g;
    this.tmpC = new THREE.Color();
  }
  spawn(x, y, z, count, colors, speed = 4, life = 0.8, size = 0.35, grav = 8, up = 3) {
    for (let k = 0; k < count; k++) {
      let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = Math.cos(a) * s * Math.sqrt(1 - e * e); this.vel[i * 3 + 1] = Math.abs(e) * s + up; this.vel[i * 3 + 2] = Math.sin(a) * s * Math.sqrt(1 - e * e);
      this.tmpC.set(Array.isArray(colors) ? pick(colors) : colors); this.col[i * 3] = this.tmpC.r; this.col[i * 3 + 1] = this.tmpC.g; this.col[i * 3 + 2] = this.tmpC.b;
      this.life[i] = this.maxLife[i] = life * (0.7 + Math.random() * 0.6); this.baseSize[i] = size * (0.6 + Math.random() * 0.8); this.grav[i] = grav;
    }
  }
  update(dt) {
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt; if (this.life[i] <= 0) continue;
      if (i !== j) { for (let k = 0; k < 3; k++) { this.pos[j * 3 + k] = this.pos[i * 3 + k]; this.vel[j * 3 + k] = this.vel[i * 3 + k]; this.col[j * 3 + k] = this.col[i * 3 + k]; } this.life[j] = this.life[i]; this.maxLife[j] = this.maxLife[i]; this.baseSize[j] = this.baseSize[i]; this.grav[j] = this.grav[i]; }
      this.vel[j * 3 + 1] -= this.grav[j] * dt; for (let k = 0; k < 3; k++) this.pos[j * 3 + k] += this.vel[j * 3 + k] * dt;
      const t = this.life[j] / this.maxLife[j]; this.alpha[j] = Math.min(1, t * 2.5); this.size[j] = this.baseSize[j] * (0.5 + 0.5 * t);
      j++;
    }
    this.n = j; for (let i = j; i < Math.min(j + 50, this.max); i++) { this.alpha[i] = 0; this.size[i] = 0; }
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

// ---------------- Input (keyboard + virtual joystick + jump button) ----------------
const Input = {
  keys: {}, btn: { jump: false }, jumpPressed: false, bound: false, pointers: new Map(), stick: { id: null, cx: 0, cy: 0, x: 0, z: 0 }, STICK_R: 54,
  bind() {
    if (this.bound) return; this.bound = true;
    const map = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump' };
    addEventListener('keydown', (e) => { const k = map[e.code]; if (k) { if (k === 'jump' && !this.keys.jump) this.jumpPressed = true; this.keys[k] = true; if (App.race && App.race.state !== 'done') e.preventDefault(); } if (e.code === 'Escape' && App.race) App.togglePause(); });
    addEventListener('keyup', (e) => { const k = map[e.code]; if (k) this.keys[k] = false; });
    addEventListener('blur', () => { this.keys = {}; this.pointers.clear(); this.stickEnd(); this.refresh(); });
    const pad = $('#controls'), zone = $('#stickzone');
    // analog joystick: appears where the thumb lands, any direction (diagonals included)
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); if (this.stick.id !== null) return; Sound.init();
      const r = Stage.rect(zone), m = 74, S = this.stick; S.id = e.pointerId; const ex = Stage.x(e), ey = Stage.y(e);
      S.cx = clamp(ex, r.left + m, Math.max(r.left + m, r.right - m)); S.cy = clamp(ey, r.top + m, Math.max(r.top + m, r.bottom - m));
      const st = $('#stick'); st.style.left = (S.cx - r.left) + 'px'; st.style.top = (S.cy - r.top) + 'px'; st.style.bottom = 'auto'; st.classList.add('on');
      this.stickMove(ex, ey);
    });
    const hit = (x, y) => { const el = document.elementFromPoint(x, y); const b = el && el.closest && el.closest('[data-btn]'); return b ? b.dataset.btn : null; };
    const onDown = (e) => { e.preventDefault(); const b = hit(e.clientX, e.clientY); this.pointers.set(e.pointerId, b); if (b === 'jump') this.jumpPressed = true; this.refresh(); Sound.init(); };
    const onMove = (e) => {
      if (e.pointerId === this.stick.id) { e.preventDefault(); this.stickMove(Stage.x(e), Stage.y(e)); return; }
      if (!this.pointers.has(e.pointerId)) return; e.preventDefault(); const b = hit(e.clientX, e.clientY); const old = this.pointers.get(e.pointerId); if (b !== old) { this.pointers.set(e.pointerId, b); if (b === 'jump') this.jumpPressed = true; this.refresh(); }
    };
    const onUp = (e) => { if (e.pointerId === this.stick.id) this.stickEnd(); this.pointers.delete(e.pointerId); this.refresh(); };
    pad.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove, { passive: false }); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  stickMove(px, py) {
    const S = this.stick, R = this.STICK_R; let dx = px - S.cx, dy = py - S.cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    $('#knob').style.transform = `translate(${dx}px,${dy}px)`;
    let nx = dx / R, nz = dy / R; const n = Math.hypot(nx, nz), dead = 0.14;
    if (n < dead) { S.x = 0; S.z = 0; } else { const k = Math.min(1, (n - dead) / (0.8 - dead)) / n; S.x = nx * k; S.z = nz * k; }
  },
  stickEnd() { const S = this.stick; S.id = null; S.x = 0; S.z = 0; const st = $('#stick'); if (st) { st.classList.remove('on'); st.style.left = ''; st.style.top = ''; st.style.bottom = ''; $('#knob').style.transform = ''; } },
  refresh() {
    for (const k in this.btn) this.btn[k] = false;
    for (const b of this.pointers.values()) if (b) this.btn[b] = true;
    $$('#controls [data-btn]').forEach((el) => el.classList.toggle('on', !!this.btn[el.dataset.btn]));
  },
  read() {
    const k = this.keys, b = this.btn, S = this.stick;
    let x = (k.right ? 1 : 0) - (k.left ? 1 : 0) + S.x, z = (k.down ? 1 : 0) - (k.up ? 1 : 0) + S.z;
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    const j = this.jumpPressed || ((k.jump || b.jump) && this._held); this._held = !!(k.jump || b.jump); this.jumpPressed = false;
    return { x, z, jump: j };
  },
};

// ---------------- Race ----------------
const _tv = new THREE.Vector3(), _tv2 = new THREE.Vector3();
class Race {
  constructor(opts) {
    this.opts = opts; this.worldId = opts.worldId; this.level = opts.level; this.N = opts.count;
    this.scene = new THREE.Scene(); const th = WORLDS[this.worldId]; this.gMul = th.gravity || 1;
    this.scene.fog = new THREE.Fog(th.fog, 90, 330);
    this.scene.add(makeSky(th.skyTop, th.skyBot, th.skyMid));
    this.scene.environment = App.envMap;
    const hemi = new THREE.HemisphereLight(0xffffff, th.ground || 0xcfd8ff, 0.45); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.0); sun.position.set(-20, 40, 25); this.scene.add(sun); this.scene.add(sun.target); this.sun = sun;
    this.useShadow = App.renderer.shadowMap.enabled;
    if (this.useShadow) { sun.castShadow = true; { const ms = Save.data.settings.quality === 'high' || Math.min(innerWidth, innerHeight) >= 600 ? 2048 : 1024; sun.shadow.mapSize.set(ms, ms); } const c = sun.shadow.camera; c.left = -30; c.right = 30; c.top = 34; c.bottom = -26; c.near = 1; c.far = 120; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; }
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
    this.subject = opts.subject || 'math'; this.room = opts.room || null; this.mapNo = 0; if (!opts.seed) { do { this.mapNo = opts.mapNo || 1 + Math.floor(Math.random() * MAPS_PER_LEVEL); } while (!opts.mapNo && this.mapNo === App._lastMap); App._lastMap = this.mapNo; } const seed = opts.seed || mapSeed(this.worldId, opts.courseLevel || this.level, this.mapNo); this.course = withSeed(seed, () => new Course(this.scene, this.worldId, opts.courseLevel || this.level, { noGates: this.subject === 'run' }));
    { const used = new Set(); this.course.qmaker = (lvl) => { let q; for (let k = 0; k < 10; k++) { q = makeSubjectQuestion(this.subject, lvl); if (!used.has(q.text)) break; } used.add(q.text); return q; }; }
    this.particles = new Particles(this.scene);
    this.racers = []; this.t = 0; this.state = 'countdown'; this.cd = 3.6; this.finishCount = 0; this.raceTime = 0;
    this.stats = { correct: 0, attempts: 0, combo: 0, maxCombo: 0, energy: 0, stomps: 0, stomped: 0, solveTimes: [], log: [] };
        this.spawnRacers();
    // blob shadows (instanced)
    const shTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(60,30,90,0.45)'); gr.addColorStop(1, 'rgba(60,30,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const shGeo = new THREE.PlaneGeometry(1.6, 1.6); shGeo.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(shGeo, new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }), this.racers.length); this.shadows.frustumCulled = false; this.scene.add(this.shadows);
    this.marker = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff3d8f })); this.marker.scale.set(0.26, 0.38, 0.26); this.marker.rotation.x = Math.PI; this.scene.add(this.marker);
    const ringGeo = new THREE.RingGeometry(0.75, 0.95, 32); ringGeo.rotateX(-Math.PI / 2); this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff5fa2, transparent: true, opacity: 0.7, depthWrite: false })); this.scene.add(this.ring);
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.snapCamera();
    this.hudT = 0; this.rankT = 0; this.order = this.racers.slice(); $('#leaderboard').onclick = () => { $('#leaderboard').classList.toggle('full'); this.updateHUD(); };
    this.buildHUD();
    this.toastQ = [];
  }
  spawnRacers() {
    const S = Save.data, N = this.N; const lookP = playerLook();
    const playerSlot = randi(Math.floor(N * 0.45), N - 1); // start somewhere mid-to-back of the grid
    const typeKeys = Object.keys(AI_TYPES); const names = shuffle(AI_NAME_A.slice());
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / 10), col = i % 10;
      let r;
      if (i === playerSlot) { r = new Racer(this, i, { name: S.profile.nick, isPlayer: true, look: lookP }); this.player = r; }
      else {
        const type = typeKeys[i % typeKeys.length], T = AI_TYPES[type];
        const lvlAdj = [0, 0.05, 0.04, 0.02, 0, -0.03, -0.06][this.level] || 0;
        const ai = { type, T, acc: clamp(rand(...T.acc) * 0.42 + lvlAdj, 0.1, 0.6), think: Math.random() * 0.1, door: null, gRound: '', commitT: 2, millX: 0, standD: 4, pauseT: 0, waitB: rand(0, 6), waitX: rand(-13, 13), jumpT: rand(1, 4), swerveT: 0, laneX: rand(-11, 11) };
        const nm = (names[i % names.length] || '말랑') + '말랑이';
        const look = { colorHex: pick(AI_COLORS), pattern: Math.random() < 0.2 ? pick(['dots', 'stripes', 'stars']) : 'none', face: pick(['normal', 'normal', 'happy', 'wink', 'determined', 'sparkle', 'cool', 'sleepy']), tuft: pick(TUFTS), hat: Math.random() < 0.18 ? pick(['beanie', 'party', 'flower', 'cap']) : 'none', glasses: Math.random() < 0.08 ? pick(['round', 'sun']) : 'none', scale: rand(0.56, 0.62) };
        r = new Racer(this, i, { name: nm, look, ai, speedMul: rand(...T.speed) * (0.84 + 0.025 * this.level + (this.subject === 'run' ? 0.07 : 0)) });
      }
      r.p.set((col - 4.5) * 2.7 + rand(-0.2, 0.2), PHYS.R + 0.05, -(4 + row * 2.6));
      if (r.isPlayer) r.view.root.scale.setScalar(0.62);
      this.racers.push(r); r.view.root.position.copy(r.p).y -= PHYS.R;
    }
  }
  // ---------- HUD ----------
  buildHUD() {
    $('#hud').classList.remove('hidden'); $('#controls').classList.remove('hidden');
    $('#hud-world').textContent = `${WORLDS[this.worldId].icon} ${WORLDS[this.worldId].name}${this.mapNo ? ' · 맵 ' + this.mapNo : ''}`;
    $('#hud-sim').textContent = this.subject === 'run' ? '🔥 피버 모드 · 에너지 2배' : `${SUBJECTS[this.subject].icon} ${SUBJECTS[this.subject].name} · AI ${this.N - 1}명`;
    $('#qpanel').classList.add('hidden'); $('#bigmsg').classList.add('hidden');
    const bar = $('#prog-marks'); bar.innerHTML = '';
    this.course.sections.slice(1, -1).forEach((d) => { const m = document.createElement('i'); m.style.left = (d / this.course.FINISH * 100) + '%'; bar.appendChild(m); });
  }
  toast(text, cls = '') { const box = $('#toasts'); if (this._lastToast === text && this.t - this._lastToastT < 1.5) return; this._lastToast = text; this._lastToastT = this.t; while (box.children.length >= 3) box.firstChild.remove(); const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 1800); }
  bigMsg(text, dur = 0.9, cls = '') { const el = $('#bigmsg'); el.textContent = text; el.className = 'bigmsg ' + cls; void el.offsetWidth; el.classList.add('pop'); clearTimeout(this._bm); this._bm = setTimeout(() => el.classList.add('hidden'), dur * 1000); }
  updateHUD() {
    const P = this.player, rank = this.order.indexOf(P) + 1, N = this.racers.length;
    $('#hud-rank').innerHTML = `<b>${rank}</b><small>/${N}</small>`;
    const secIdx = this.course.sections.findIndex((d, i) => i > 0 && P.d < d); const nSec = this.course.sections.length - 1;
    $('#hud-sec').textContent = `구간 ${P.finished ? nSec : Math.max(1, secIdx)} / ${nSec}`;
    const tt = this.raceTime; $('#hud-time').textContent = `${String(Math.floor(tt / 60)).padStart(2, '0')}:${String(Math.floor(tt % 60)).padStart(2, '0')}`;
    $('#prog-me').style.left = clamp(P.d / this.course.FINISH * 100, 0, 100) + '%';
    // leader dot
    const lead = this.order[0]; $('#prog-lead').style.left = clamp(lead.progress() >= 99000 ? 100 : lead.d / this.course.FINISH * 100, 0, 100) + '%';
    $('#hud-energy').textContent = `⚡ ${this.stats.energy}`;
    $('#hud-combo').textContent = this.stats.combo >= 2 ? `콤보 ×${this.stats.combo}` : '';
    // gap ahead/behind
    const ahead = this.order[rank - 2], behind = this.order[rank];
    const fmt = (o) => (o ? (o.finished ? '완주' : Math.abs(o.progress() - P.progress()).toFixed(1) + 'm') : '-');
    $('#hud-gap').innerHTML = `<span>▲ 앞 ${ahead ? fmt(ahead) : '없음'}</span><span>▼ 뒤 ${behind ? fmt(behind) : '없음'}</span>`;
    // mini leaderboard: top3 + around me
    const rows = []; const add = (i) => { const o = this.order[i]; if (!o || rows.some((r) => r.i === i)) return; rows.push({ i, o }); };
    // compact by default (1st + the racers right around me) so it does not hide the course; tap to see more
    const full = $('#leaderboard').classList.contains('full'); add(0); if (full) { add(1); add(2); } add(rank - 2); add(rank - 1); add(rank);
    rows.sort((a, b) => a.i - b.i);
    let html = ''; let last = -1;
    for (const { i, o } of rows) { if (i - last > 1) html += `<div class="lb-gap">⋯</div>`; html += `<div class="lb-row ${o.isPlayer ? 'me' : ''}"><span class="lb-n">${i + 1}</span><span class="lb-dot" style="background:#${o.color.toString(16).padStart(6, '0')}"></span><span class="lb-name">${escapeHtml(o.isPlayer ? o.name + ' (나)' : o.name)}</span>${o.finished ? '<span class="lb-f">🏁</span>' : ''}</div>`; last = i; }
    if (last < N - 1) html += `<div class="lb-gap">외 ${N - 1 - last}명</div>`;
    $('#leaderboard').innerHTML = html;
  }
  showQuestion(G) {
    const P = this.player; const el = $('#qpanel');
    if (!G) { if (this._qHtml) { this._qHtml = ''; el.classList.add('hidden'); } return; }
    let html; const title = `숫자 에너지 관문 ${G.idx + 1}`;
    const al = G.allowed.get(P);
    const mySlot = P.d >= G.d - GATE_ZONE && P.d <= G.d + 0.7 ? G.slotAt(P.p.x) : -1;
    const chips = (rev) => `<div class="q-chips">${G.doors.map((dr) => `<span class="q-chip ${dr.i === mySlot ? 'me' : ''} ${rev ? (dr.correct ? 'ok' : 'no') : ''}" style="background:${dr.color}">${escapeHtml(dr.value)}</span>`).join('')}</div>`;
    if (G.state === 'ask') {
      const n = Math.ceil(G.timer), inZone = P.d >= G.d - GATE_ZONE;
      html = `<div class="q-title">${title} · 정답 칸 ${G.correctCount}개</div><div class="q-text">${escapeHtml(G.q.text)}</div>${chips(false)}<div class="q-count ${n <= GATE_COUNT ? 'hot' : ''}">${n <= GATE_COUNT ? `⏱ ${Math.max(1, n)}` : `칸 고르기 ${n - GATE_COUNT}초`}</div><div class="q-sub">${n <= GATE_COUNT ? (inZone ? '벽이 올라왔어요! 이제 칸을 바꿀 수 없어요' : '칸이 닫혔어요. 다음 문제를 기다려요') : (inZone ? '정답 칸으로 이동해요! 곧 벽이 올라와요' : '어서 숫자 칸으로 들어가요!')}</div>`;
    } else if (G.state === 'reveal') {
      if (al !== undefined) html = `<div class="q-title">${title}</div><div class="q-text">${escapeHtml(G.q.textAnswer ? `정답: ${G.answerText}` : G.q.text.replace('?', G.answerText))}</div>${chips(true)}<div class="q-sub">${al > 0 ? `정답 칸 친구들 먼저! ${Math.ceil(al)}초 뒤 벽이 내려가면 정답 문으로 통과해요` : '빛나는 정답 문으로 통과해요!'}</div>`;
      else html = `<div class="q-title">${title}</div><div class="q-sub">앞 친구들이 통과하는 중이에요. 곧 새 문제가 나와요!</div>`;
    } else if (al !== undefined) html = `<div class="q-title">${title}</div><div class="q-sub">아무 문으로나 통과해요!</div>`;
    else if (G.waitN) html = `<div class="q-title">${title}</div><div class="q-text">모이는 중 ${G.waitN} / ${G.waitTotal}</div><div class="q-sub">${P.d >= G.d - GATE_ZONE - GATE_GATHER ? '모두 모이면 장벽이 내려가고 문제가 나와요!' : '모두 장벽 앞에서 기다려요. 어서 가요!'}</div>`;
    else html = `<div class="q-title">${title}</div><div class="q-sub">장벽 앞에 다 모이면 문제가 나와요</div>`;
    if (html !== this._qHtml) { this._qHtml = html; el.innerHTML = html; el.classList.remove('hidden'); }
  }
  // ---------- core loop ----------
  snapCamera() { const P = this.player; this.camPos.set(P.p.x, P.p.y + 5.4, P.p.z + 9.6); this.camLook.set(P.p.x, P.p.y + 0.8, P.p.z - 7); }
  update(dt) {
    this.t += dt; this.dt = dt;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.cd); this.cd -= dt; const now = Math.ceil(this.cd);
      if (now !== before && now >= 1 && now <= 3) { this.bigMsg(String(now), 0.8, 'count'); Sound.play('count'); }
      if (this.cd <= 0) { this.state = 'run'; this.bigMsg('출발!', 1, 'go'); Sound.play('go'); }
    }
    if (this.state === 'run' || this.state === 'finished') this.raceTime += this.state === 'run' ? dt : 0;
    this.course.update(this.t, dt);
    { const P = this.player, L = this.course.starList; if (P && L && this.state === 'run' && P.respawnT <= 0) for (const s of L) { if (s.got) continue; const dz = P.p.z - s.z; if (dz > 2 || dz < -2) continue; const dx = P.p.x - s.x, dy = P.p.y - s.y; if (dx * dx + dy * dy + dz * dz < 2.6) { s.got = true; s.m.visible = false; this.stats.stars = (this.stats.stars || 0) + 1; this.stats.energy += 2; Sound.play('coin'); this.particles.spawn(s.x, s.y, s.z, 10, ['#ffe11f', '#fff7b0'], 4, 0.5, 0.35, 4, 2); } } }
    const running = this.state === 'run' || this.state === 'finished' || this.state === 'done';
    // player input
    const P = this.player;
    if (!P.finished) { const inp = Input.read(); P.in.x = inp.x; P.in.z = inp.z; if (inp.jump) P.jumpBuf = 0.14; }
    else { Input.read(); P.in.x = 0; P.in.z = P.d < this.course.FINISH + 8 ? -0.6 : 0; }
    // AI
    for (const r of this.racers) if (r.ai) this.thinkAI(r, dt);
    // physics
    const steps = dt > 1 / 45 ? 2 : 1, h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const r of this.racers) this.stepRacer(r, h, running);
      this.racerContacts();
    }
    // gates + finish + checkpoints
    for (const r of this.racers) this.progressChecks(r);
    if (this.state !== 'countdown') for (const G of this.course.gates) this.gateLogic(G);
    const nextG = this.course.gates.find((G) => !G.passed.has(P) && G.d - P.d < 40 && G.d - P.d > -2);
    if (nextG && nextG.state === 'ask') { const n = Math.ceil(nextG.timer), key = nextG.idx * 100 + nextG.round * 10 + n; if (key !== this._gcN) { this._gcN = key; if (n >= 1 && n <= GATE_COUNT) Sound.play('count'); } }
    for (const G of this.course.gates) G.ghost = G.passed.has(P) && this.camPos.z > G.z - 6 ? 1 : 0;
    this.showQuestion(nextG);
    // views
    for (const r of this.racers) this.updateView(r, dt);
    this.fwT = (this.fwT || 0) - dt;
    if (this.fwT <= 0 && (this.state === 'run' || this.state === 'finished')) { this.fwT = this.state === 'finished' ? 0.35 : rand(1.2, 2.4); const P = this.player; if (P) { const cs = pick([['#ff3b5c', '#ffe11f'], ['#20b8ff', '#ffffff'], ['#8a5cff', '#ff4fd8'], ['#3fd35a', '#ffe11f'], ['#ff9a1f', '#ff3b5c']]); this.particles.spawn(rand(-45, 45), rand(26, 40), P.p.z - rand(50, 110), 46, cs, 16, 1.5, 2.2, 4, 0); } }
    this.particles.update(dt);
    // ranking
    this.rankT -= dt; if (this.rankT <= 0) { this.rankT = 0.25; this.order = this.racers.slice().sort((a, b) => b.progress() - a.progress()); }
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.12; this.updateHUD(); }
    this.updateCamera(dt);
    if (this.state === 'finished') { this.endT -= dt; if (this.endT <= 0) { this.state = 'done'; App.showResults(this.results()); } }
  }
  stepRacer(r, dt, running) {
    if (r.respawnT > 0) { r.respawnT -= dt; if (r.respawnT <= 0) this.respawn(r); return; }
    // ride moving platforms
    if (r.ground && r.gs && r.gs.motion) { r.gs.pointVel(r.p, _tv); r.p.x += _tv.x * dt; r.p.z += _tv.z * dt; }
    const frozen = !running || (r.finished && !r.isPlayer && r.d > this.course.FINISH + 6);
    let ix = r.in.x, iz = r.in.z; if (frozen || r.stunT > 0 || r.flatT > 0) { ix = 0; iz = 0; }
    const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    if (iz > 0) iz *= 0.65; // backwards is slower
    const fxm = r.ground && r.gs && r.gs.fx ? (r.gs.fx === 'fast' ? 1.6 : 0.45) : 1; if (fxm > 1 && r.isPlayer && Math.random() < 0.3) this.particles.spawn(r.p.x, r.p.y - 0.4, r.p.z + 0.5, 1, ['#b6ff3f', '#ffffff'], 1.5, 0.35, 0.3, 0, 0.5);
    let tx = ix * r.speed * fxm, tz = iz * r.speed * fxm;
    const slip = r.ground && r.gs && r.gs.slip;
    if (slip && r.gs.conv) { tz += r.gs.conv.z; }
    let acc = r.ground ? (slip ? 14 : PHYS.ACC_G) : PHYS.ACC_A; if (r.stunT > 0) acc = 5; if (r.flatT > 0) acc = 30;
    const dvx = tx - r.v.x, dvz = tz - r.v.z, dl = Math.hypot(dvx, dvz), st = acc * dt;
    if (dl > st) { r.v.x += dvx / dl * st; r.v.z += dvz / dl * st; } else { r.v.x = tx; r.v.z = tz; }
    const wind = this.course.winds.length ? this.course.windAt(r.d, this.t) : 0; if (wind && !r.finished) r.v.x += wind * dt * (r.ground ? 1 : 0.6);
    r.v.y -= PHYS.G * this.gMul * dt;
    // jump
    if (r.jumpBuf > 0) r.jumpBuf -= dt; if (r.jumpCD > 0) r.jumpCD -= dt;
    if (r.jumpBuf > 0 && (r.ground || r.coyote > 0) && r.jumpCD <= 0 && r.flatT <= 0 && !frozen) {
      r.v.y = PHYS.JUMP; r.ground = false; r.coyote = 0; r.jumpBuf = 0; r.jumpCD = 0.25; r.view.stretch(0.38);
      if (r.isPlayer) Sound.play('jump');
    }
    r.lastVy = r.v.y;
    if (r.ground && r.gs && r.gs.conv && !r.gs.slip) r.p.addScaledVector(r.gs.conv, dt); // conveyor belt
    r.p.addScaledVector(r.v, dt);
    // collisions
    const wasGround = r.ground; r.ground = false; r.gs = null;
    for (let it = 0; it < 2; it++) {
      const list = this.course.near(r.p.z);
      for (let i = 0; i < list.length; i++) {
        const s = list[i]; if (!s.enabled) continue;
        const depth = collideSphere(s, r.p.x, r.p.y, r.p.z, r.r); if (!depth) continue;
        if (s.kind === 'door' && this.doorContact(r, s)) continue;
        const nx = _col.nx, ny = _col.ny, nz = _col.nz;
        r.p.x += nx * depth; r.p.y += ny * depth; r.p.z += nz * depth;
        const vn = r.v.x * nx + r.v.y * ny + r.v.z * nz;
        if (vn < 0) { r.v.x -= nx * vn; r.v.y -= ny * vn; r.v.z -= nz * vn; }
        if (s.kind === 'stomper' && ny < -0.3 && s.vel.y < -2 && r.bounceCD <= 0) {
          r.view.flatten(0.7); r.flatT = 0.7; r.bounceCD = 0.8; r.v.x = (r.p.x >= s.c.x ? 1 : -1) * 7; r.v.z = 2; r.view.setFace('dizzy', 1);
          if (this.near(r)) Sound.play('squished'); this.particles.spawn(r.p.x, r.p.y, r.p.z, 10, ['#ffffff', '#ffe680'], 4, 0.4, 0.3, 6, 1);
        }
        if (ny > 0.55) {
          r.ground = true; r.gs = s;
          if (s.kind === 'pad') { r.v.y = s.pad; r.v.z -= 3; r.ground = false; r.gs = null; s.padAnim = 0.6; r.view.stretch(0.55); if (this.near(r)) Sound.play('pad'); this.particles.spawn(r.p.x, r.p.y - 0.4, r.p.z, 10, ['#ffffff', '#fff3a0'], 3, 0.5, 0.35, 4, 1); }
          if (s.kind === 'pad' && s.mystery) {
            if (Math.random() < 0.5) { r.v.z = -13; r.v.y = 17; if (r.isPlayer) { this.toast('행운의 발판! 슈웅 🚀', 'good'); Sound.play('correct'); } }
            else { r.v.z = 13; r.v.y = 9; r.stunT = 0.7; r.view.setFace('dizzy', 1); if (r.isPlayer) { this.toast('앗, 함정 발판이었어요! 🙃'); Sound.play('wrong'); } }
          }
          if (s.kind === 'crumble' && s.timer < 0) { s.timer = 0; if (r.isPlayer) Sound.play('crumble'); }
        } else if (ny > -0.5) {
          if (s.kind === 'bumper' && r.bounceCD <= 0) {
            const hl = Math.hypot(nx, nz) || 1; r.v.x = nx / hl * s.bounce; r.v.z = nz / hl * s.bounce; r.v.y = Math.max(r.v.y, 4); r.stunT = 0.28; r.bounceCD = 0.15; r.view.bump(1.1);
            if (this.near(r)) Sound.play('boing'); s.vis && (s.wob = 1);
          } else if ((s.kind === 'sweeper' || s.kind === 'laser') && r.bounceCD <= 0) {
            s.pointVel(r.p, _tv); const hl = Math.hypot(nx, nz) || 1;
            r.v.x = nx / hl * s.knock + _tv.x * 0.7; r.v.z = nz / hl * s.knock + _tv.z * 0.7; r.v.y = 6.5; r.stunT = 0.5; r.bounceCD = 0.3; r.ground = false;
            r.view.bump(1.6); r.view.setFace('dizzy', 0.9);
            if (r.isPlayer) Sound.play(s.kind === 'laser' ? 'zap' : 'hit');
            this.particles.spawn(r.p.x, r.p.y, r.p.z, 8, ['#ffffff', '#ffe680'], 4, 0.4, 0.3, 6, 1);
          } else if (s.kind === 'pusher' && s.motion) {
            s.pointVel(r.p, _tv); const pn = _tv.x * nx + _tv.z * nz; if (pn > 0) { r.v.x += nx * pn * 1.2; r.v.z += nz * pn * 1.2; r.stunT = Math.max(r.stunT, 0.15); }
          }
        }
      }
    }
    if (r.ground && !wasGround && r.lastVy < -6) { r.view.land(clamp(-r.lastVy / 22, 0.15, 0.6)); if (r.isPlayer) Sound.play('land'); if (r.lastVy < -12) this.particles.spawn(r.p.x, r.p.y - 0.5, r.p.z, 6, '#ffffff', 2.5, 0.4, 0.3, 2, 0.5); }
    r.coyote = r.ground ? 0.1 : r.coyote - dt;
    if (r.stunT > 0) r.stunT -= dt; if (r.flatT > 0) r.flatT -= dt; if (r.stompCD > 0) r.stompCD -= dt; if (r.immuneT > 0) r.immuneT -= dt; if (r.bounceCD > 0) r.bounceCD -= dt;
    // fell off
    if (r.p.y < -14) { r.respawnT = 1.0; if (r.isPlayer) { Sound.play('fall'); this.toast('앗, 떨어졌어요! 체크포인트에서 다시 출발'); } }
  }
  near(r) { return Math.abs(r.p.z - this.player.p.z) < 25; }
  respawn(r) {
    const cp = this.course.checkpoints[r.cp];
    r.p.set(cp.x != null ? cp.x + rand(-1.5, 1.5) : rand(-6, 6), cp.y + 2.2, -cp.d); r.v.set(0, 0, 0); r.stunT = 0; r.flatT = 0; r.immuneT = 1.5; r.view.stretch(0.3);
    if (r.ai) { r.ai.laneX = cp.x != null ? cp.x : rand(-6, 6); }
    this.particles.spawn(r.p.x, r.p.y, r.p.z, 12, ['#ffffff', '#c9b6ff'], 3, 0.6, 0.4, 2, 1);
  }
  // doors are walls until this racer has been let through by a reveal
  doorContact(r, s) {
    const G = s.gate, dr = G.doors[s.door], al = G.allowed.get(r);
    if (al === undefined || al > 0) return false;
    if (G.state === 'reveal' && G.pending.has(r)) return dr.correct;
    return true;
  }
  gateLogic(G) {
    if (G.state === 'reveal') { let left = 0; for (const r of G.pending) if (!G.passed.has(r) && r.respawnT <= 0) left++; if ((left === 0 && G.revealT > 1.0) || G.revealT > 8) G.close(); return; }
    if (G.state === 'ask' && G.timer > 0) return;
    const wait = []; for (const r of this.racers) if (!G.passed.has(r) && !G.allowed.has(r) && r.respawnT <= 0 && r.d >= G.d - GATE_ZONE && r.d <= G.d + 0.7) wait.push(r);
    if (G.state === 'idle') { // everyone gathers at the barrier in front of the pads; it drops once all have arrived
      let total = 0, here = 0, pHere = false; const P = this.player;
      for (const r of this.racers) { if (G.passed.has(r) || G.allowed.has(r)) continue; total++; if (r.respawnT <= 0 && r.d >= G.d - GATE_ZONE - GATE_GATHER && r.d <= G.d + 0.7) { here++; if (r === P) pHere = true; } }
      G.waitN = here; G.waitTotal = total;
      if (!here) { G.gatherT = 0; return; }
      G.gatherT = (G.gatherT || 0) + this.dt; const pIn = G.passed.has(P) || G.allowed.has(P) || pHere;
      if (here >= total || G.gatherT > (pIn ? 8 : 22)) { G.gatherT = 0; G.startRound(this.level); if (Math.abs(G.d - P.d) < 30) Sound.play('go'); }
      return;
    }
    // countdown finished: reveal the answer
    if (!wait.length) { G.close(); return; }
    G.reveal(); const P = this.player, st = this.stats; let nOk = 0;
    for (const r of wait) {
      const dr = G.doors[G.slotAt(r.p.x)], ok = dr.correct; G.pending.add(r); r.quizN = (r.quizN || 0) + 1; if (ok) r.quizOk = (r.quizOk || 0) + 1; G.allowed.set(r, ok ? 0 : GATE_HOLD); if (ok) nOk++;
      if (ok) { r.view.setFace('joy', 1.2); r.view.stretch(0.3); dr.flashT = 0.6; }
      else { r.v.y = 5; r.ground = false; r.stunT = 0.3; r.view.bump(1.3); r.view.setFace('oops', 1.5); dr.shieldT = 0.9; }
      if (r.isPlayer) {
        r.gateResult[G.idx] = ok ? 'correct' : 'wrong'; st.attempts++; recordAnswer(G.q, dr.value, ok, 'race'); st.log.push({ q: G.q.text, chosen: dr.value, answer: G.q.answer, ok }); st.solveTimes.push(ok ? 4 : 12);
        if (ok) {
          st.correct++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); const gain = 10 + (st.combo - 1) * 5; st.energy += gain;
          Sound.play('correct'); this.bigMsg(st.combo >= 2 ? `정답! 콤보 ×${st.combo}` : '정답!', 1.2, 'good'); this.toast(`숫자 에너지 +${gain} ⚡ 먼저 통과해요!`, 'good');
          for (let k = 0; k < 3; k++) this.particles.spawn(r.p.x, 1.5, r.p.z, 12, ['#fff38a', '#ffd23f'], 5, 0.7, 0.45, -2, 0);
        } else {
          st.combo = 0; Sound.play('wrong'); Sound.play('shield'); this.bigMsg(`아쉬워요! 정답은 ${G.answerText}`, 1.6, 'bad'); this.toast('정답 칸 친구들이 먼저 지나가면 정답 문으로 통과해요', 'bad');
        }
      }
    }
    if (Math.abs(G.d - P.d) < 30) { for (const dr of G.doors) if (dr.correct) this.particles.spawn(dr.x, 2.4, G.z + 0.6, 14, ['#fff38a', '#ffffff', dr.color], 5, 0.8, 0.45, 2, 2); if (!wait.includes(P)) Sound.play('go'); }
  }
  progressChecks(r) {
    if (r.respawnT > 0) return;
    // checkpoints (only reachable ones; gates block until answered)
    const cps = this.course.checkpoints;
    while (r.cp + 1 < cps.length && r.d >= cps[r.cp + 1].d && r.ground) r.cp++;
    for (const G of this.course.gates) {
      if (!G.passed.has(r) && r.p.z < G.z - 0.45 && r.p.z > G.z - 4) {
        G.passed.add(r);
        let best = G.doors[0]; for (const dr of G.doors) if (Math.abs(dr.x - r.p.x) < Math.abs(best.x - r.p.x)) best = dr;
        best.flashT = 0.5;
        const near = this.near(r);
        if (near) this.particles.spawn(r.p.x, r.p.y + 0.4, r.p.z, r.isPlayer ? 40 : 10, ['#fff38a', '#ffffff', best.color, '#9ff3ff'], r.isPlayer ? 7 : 4, 0.9, r.isPlayer ? 0.55 : 0.4, 3, 2);
        if (r.ai) { r.ai.door = null; r.ai.waitX = rand(-13, 13); r.ai.waitB = rand(0, 6); r.ai.laneX = rand(-11, 11); }
        if (r.isPlayer) { r.view.stretch(0.3); Sound.play('pad'); if (r.gateResult[G.idx] !== 'correct') { this.stats.energy += 3; this.bigMsg('통과!', 0.9, 'good'); this.toast('통과! +3 ⚡ (틀린 문제는 오답노트에 저장됐어요)', 'good'); } }
      }
    }
    if (!r.finished && r.d >= this.course.FINISH) {
      r.finished = true; r.place = ++this.finishCount; r.finishTime = this.raceTime;
      if (this.near(r)) this.particles.spawn(r.p.x, r.p.y + 1, r.p.z, r.isPlayer ? 80 : 12, ['#ff7eb6', '#ffd84d', '#7fe7ff', '#9be35a', '#a77bff'], 8, 1.4, 0.5, 6, 6);
      if (r.isPlayer) { this.state = 'finished'; this.endT = 3.2; Sound.play('finish'); this.bigMsg(`${r.place}번째로 골인!`, 3, 'go'); r.view.setFace('joy', 4); }
    }
  }
  racerContacts() {
    const R = this.racers, n = R.length, D = PHYS.R * 2;
    for (let i = 0; i < n; i++) {
      const a = R[i]; if (a.respawnT > 0) continue;
      for (let j = i + 1; j < n; j++) {
        const b = R[j]; if (b.respawnT > 0) continue;
        const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z; if (dx > D || dx < -D || dz > D || dz < -D) continue;
        const dy = b.p.y - a.p.y; if (dy > 1.6 || dy < -1.6) continue;
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= D * D) continue;
        const hd = Math.hypot(dx, dz);
        const up = dy > 0 ? b : a, lo = dy > 0 ? a : b;
        if (Math.abs(dy) > 0.6 && hd < 0.95 && up.v.y < 2.5 && !up.ground) {
          if (lo.immuneT <= 0 && up.stompCD <= 0 && lo.flatT <= 0) this.stomp(up, lo);
          else { up.v.y = 7.5; up.p.y = Math.max(up.p.y, lo.p.y + 1.1); }
          continue;
        }
        const d = Math.sqrt(d2) || 0.001; let nx = dx / d, ny = dy / d, nz = dz / d; if (hd < 0.001) { nx = Math.random() - 0.5; nz = 0.5; }
        const ov = (D - d) * 0.5;
        a.p.x -= nx * ov; a.p.z -= nz * ov; b.p.x += nx * ov; b.p.z += nz * ov;
        const rel = (b.v.x - a.v.x) * nx + (b.v.z - a.v.z) * nz;
        if (rel < 0) {
          let imp = -rel * 0.65; const bm = (a.ai && a.ai.T.aggro > 0.8) || (b.ai && b.ai.T.aggro > 0.8) ? 1.6 : 1;
          imp *= bm; a.v.x -= nx * imp; a.v.z -= nz * imp; b.v.x += nx * imp; b.v.z += nz * imp;
          if (imp > 3) { a.view.bump(0.5); b.view.bump(0.5); if ((a.isPlayer || b.isPlayer) && imp > 4) Sound.play('land'); }
        }
      }
    }
  }
  stomp(up, lo) {
    lo.view.flatten(0.55); lo.flatT = 0.45; lo.immuneT = 1.3; lo.v.x *= 0.2; lo.v.z *= 0.2;
    up.v.y = PHYS.STOMP_BOUNCE; up.p.y = lo.p.y + 1.15; up.stompCD = 0.45; up.ground = false; up.view.stretch(0.45); up.view.setFace('joy', 0.8);
    this.particles.spawn(lo.p.x, lo.p.y + 0.2, lo.p.z, 14, ['#' + lo.color.toString(16).padStart(6, '0'), '#ffffff'], 4, 0.6, 0.4, 10, 2);
    this.particles.spawn(lo.p.x, lo.p.y + 0.9, lo.p.z, 6, ['#ffe14d', '#fff7b0'], 2.5, 0.7, 0.45, -1, 1.5);
    if (up.isPlayer) { this.stats.stomps++; Sound.play('stomp'); this.toast(`${lo.name}을(를) 밟았어요! 뿅!`, 'good'); }
    else if (lo.isPlayer) { this.stats.stomped++; Sound.play('squished'); this.toast(`${up.name}에게 밟혔어요! 금방 복구돼요`, ''); }
    else if (this.near(lo)) Sound.play('stomp');
  }
  // ---------- AI ----------
  thinkAI(r, dt) {
    const A = r.ai, T = A.T; if (r.finished) { r.in.x = 0; r.in.z = r.d < this.course.FINISH + 5 ? -0.5 : 0; return; }
    if (r.respawnT > 0) return;
    A.think -= dt; A.pauseT -= dt; A.jumpT -= dt; A.swerveT -= dt;
    const C = this.course, d = r.d;
    // ---- gates ----
    const G = C.gates.find((g) => !g.passed.has(r) && g.d - d < 20 && g.d - d > -1);
    if (G) {
      const al = G.allowed.get(r); let tx, td;
      if (al !== undefined) { // let through (or waiting for the correct racers to go first)
        const mustCorrect = G.state === 'reveal' && G.pending.has(r);
        if (!A.door || (mustCorrect && !A.door.correct)) { let best = null; for (const dr of G.doors) if ((!mustCorrect || dr.correct) && (!best || Math.abs(dr.x - r.p.x) < Math.abs(best.x - r.p.x))) best = dr; A.door = best; }
        const dx = A.door.x - r.p.x;
        if (al > 0) { tx = A.door.x + (r.idx % 5 - 2) * 1.0; td = G.d - 2.2 - (r.idx % 3) * 1.2; }
        else { r.in.x = clamp(dx * 1.2, -1, 1); r.in.z = Math.abs(dx) < 2.4 || G.d - d > 3 ? -1 : 0.25; return; }
      } else if (G.state === 'ask') {
        const key = G.idx + ':' + G.round;
        if (A.gRound !== key) { // secretly decide which pad to stand on; only move there late so the crowd gives little away
          A.gRound = key; let door;
          if (Math.random() < A.acc) door = pick(G.doors.filter((x) => x.correct));
          else if (Math.random() < 0.55 && G.decoys.length) door = pick(G.decoys);
          else door = pick(G.doors.filter((x) => !x.correct));
          A.door = door; A.commitT = GATE_COUNT + rand(1.0, 2.7) + (T.mistake > 0.2 ? -0.7 : 0); A.standD = rand(1.2, 6.4);
          A.millX = clamp(door.x + (Math.random() < 0.5 ? -1 : 1) * rand(4, 11), -GATE_HALF + 1.2, GATE_HALF - 1.2); A.jit = rand(-2.6, 2.6);
        }
        tx = G.timer <= A.commitT ? A.door.x + A.jit : A.millX; td = G.d - A.standD;
        if (G.locked) { if (d < G.d - GATE_ZONE) { tx = r.p.x; td = G.d - GATE_ZONE - 1.2 - A.waitB; } else tx = G.doors[G.slotAt(r.p.x)].x + A.jit; }
      } else { tx = clamp(A.waitX, -13, 13); td = G.d - GATE_ZONE - 1.2 - A.waitB; }
      r.in.x = clamp((tx - r.p.x) * 0.9, -1, 1); r.in.z = clamp((d - td) * 0.9, -1, 1);
      return;
    }
    if (A.think > 0) return; A.think = 0.09 + Math.random() * 0.04;
    if (A.pauseT > 0) { r.in.x = 0; r.in.z = 0; return; }
    if (T.mistake > 0 && Math.random() < T.mistake * 0.02) { A.pauseT = rand(0.3, 0.9); return; }
    // lane selection with obstacle look-ahead
    let target = A.laneX;
    const hint = C.lanesHint.find((h) => d > h.d0 - 12 && d < h.d1 - 1);
    if (hint && (hint.must || T.jump < 0.9)) target = hint.x;
    // aggressive racers steer toward neighbours, stompers line up behind someone
    if ((T.aggro > 0.5 || T.stomp > 0.5) && !hint) {
      let best = null, bd = 9; for (const o of this.racers) { if (o === r || o.respawnT > 0) continue; const ddz = r.p.z - o.p.z; if (ddz < 0.5 || ddz > 5) continue; const dd = Math.abs(o.p.x - r.p.x) + ddz * 0.5; if (dd < bd) { bd = dd; best = o; } }
      if (best) { target = best.p.x; if (T.stomp > 0.5 && r.ground && r.p.z - best.p.z < 2.6 && r.p.z - best.p.z > 1.2 && Math.abs(best.p.x - r.p.x) < 0.8) r.jumpBuf = 0.12; }
    }
    const look = 2.2 + T.caution * 3, y = r.p.y;
    const blocked = (x, ahead) => { const z = r.p.z - ahead; for (const s of C.near(z)) { if (!s.enabled || s.kind === 'floor' || s.kind === 'crumble' || s.kind === 'platform' || s.kind === 'pad') continue; if (s.kind === 'door') continue; if (collideSphere(s, x, y, z, 0.85)) return s; } return null; };
    let hit = blocked(r.p.x, look) || blocked(r.p.x, look * 0.5);
    if (hit && (hit.kind === 'sweeper' || hit.kind === 'laser') && r.ground && Math.random() < 0.55 + T.jump * 0.4) { r.jumpBuf = 0.12; hit = null; }
    if (hit) {
      let bestX = null;
      for (let k = 1; k <= 7; k++) for (const sgn of [-1, 1]) { const x = clamp(r.p.x + sgn * k * 1.5, -13.5, 13.5); if (bestX === null && !blocked(x, look) && !blocked(x, look * 0.5)) bestX = x; }
      if (bestX !== null) { target = bestX; A.laneX = bestX; }
      else if (T.caution > 0.5) { r.in.z = 0.2; r.in.x = 0; return; }
    }
    // gaps: jump when the floor ends ahead
    if (r.ground) {
      const gHere = r.p.y - r.r;
      const gAhead = C.groundAt(r.p.x, r.p.z - 1.4, r.p.y + 0.5);
      if (gAhead < gHere - 1.5) {
        const land = C.groundAt(r.p.x, r.p.z - 6, r.p.y + 2, 0.7);
        if (land > gHere - 1.5 || T.caution < 0.3 || Math.random() < 0.15) r.jumpBuf = 0.12;
        else { r.in.z = 0.15; r.in.x = clamp((target - r.p.x) * 0.5, -1, 1); return; }
      }
      if (A.jumpT <= 0) { A.jumpT = rand(1.2, 4) / (0.3 + T.jump); if (Math.random() < T.jump) r.jumpBuf = 0.12; }
    }
    if (T.mistake > 0.2 && A.swerveT <= 0 && Math.random() < 0.05) { A.swerveT = 1; target += rand(-4, 4); }
    if (Math.random() < 0.02) A.laneX = clamp(A.laneX + rand(-3, 3), -12, 12);
    r.in.x = clamp((target - r.p.x) * 0.7, -1, 1); r.in.z = -1;
  }
  // ---------- visuals ----------
  updateView(r, dt) {
    const V = r.view; const sp = Math.hypot(r.v.x, r.v.z);
    if (r.respawnT > 0) { V.root.visible = false; if (r.isPlayer) { this.marker.visible = false; this.ring.visible = false; } return; } V.root.visible = true;
    V.root.position.set(r.p.x, r.p.y - r.r, r.p.z);
    if (sp > 0.8 && r.flatT <= 0) { const ty = Math.atan2(r.v.x, r.v.z); let dy = ty - r.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; r.yaw += dy * Math.min(1, dt * 10); V.yaw.rotation.y = r.yaw; }
    V.update(dt, clamp(sp / PHYS.SPEED, 0, 1), r.ground, sp > 1);
    const dc = this.camera.position.distanceTo(V.root.position); V.setDetail(dc < 30 || r.isPlayer);
    // shadow
    const gy = this.course.groundAt(r.p.x, r.p.z, r.p.y); const i = r.idx;
    if (gy > -50) { const hgt = r.p.y - r.r - gy, s = clamp(1 - hgt * 0.12, 0.35, 1); _m4.makeScale(s, 1, s); _m4.setPosition(r.p.x, gy + 0.03, r.p.z); } else _m4.makeScale(0, 0, 0);
    this.shadows.setMatrixAt(i, _m4); this.shadows.instanceMatrix.needsUpdate = true;
    if (r.isPlayer) { this.marker.position.set(r.p.x, r.p.y + 1.25 + Math.sin(this.t * 5) * 0.12, r.p.z); this.marker.visible = true; this.ring.visible = gy > -50; this.ring.position.set(r.p.x, gy + 0.05, r.p.z); }
    // trail cosmetic (player only)
    if (r.isPlayer && sp > 2) { r.trailT -= dt; const tr = Save.data.equip.trail; if (tr !== 'none' && r.trailT <= 0) { r.trailT = 0.05; spawnTrail(this.particles, tr, r.p); } }
  }
  updateCamera(dt) {
    const P = this.player, port = App.aspect < 1;
    if (this.useShadow) { const sx = Math.round(P.p.x / 2) * 2, sz = Math.round(P.p.z / 2) * 2; this.sun.target.position.set(sx, 0, sz - 8); this.sun.position.set(sx - 18, 42, sz + 14); }
    const G = this.course.gates.find((g) => !g.passed.has(P) && g.d - P.d < 24 && g.d - P.d > -1);
    const k = G ? clamp((24 - (G.d - P.d)) / 10, 0, 1) : 0; this.gateK = damp(this.gateK || 0, k, 3, dt); const gk = this.gateK;
    const small = Math.min(innerWidth, innerHeight) < 500; // phones: sit a little closer so the mallang looks bigger
    const back = (port ? 11.5 : small ? 8.2 : 9.6) + gk * (port ? 13 : 6.5), hgt = (port ? 6.4 : small ? 4.7 : 5.4) + gk * (port ? 11 : 5.5);
    const tx = lerp(P.p.x * 0.85, P.p.x * (port ? 0.8 : 0.4), gk), ty = Math.max(P.p.y, (P.ground ? P.p.y : P.p.y - 0.5)) + hgt, tz = P.p.z + back;
    this.camPos.x = damp(this.camPos.x, tx, 6, dt); this.camPos.z = damp(this.camPos.z, tz, 7, dt); this.camPos.y = damp(this.camPos.y, ty, 3.2, dt);
    this.camLook.x = damp(this.camLook.x, lerp(P.p.x * 0.9, P.p.x * (port ? 0.8 : 0.3), gk), 7, dt); this.camLook.y = damp(this.camLook.y, P.p.y + 0.8, 4, dt); this.camLook.z = damp(this.camLook.z, P.p.z - 7, 8, dt);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    const asp = App.aspect || 16 / 9, vf = port ? 70 : asp > 16 / 9 ? 2 * Math.atan(Math.tan(31 * Math.PI / 180) * (16 / 9) / asp) * 180 / Math.PI : 62;
    this.camera.fov = Math.max(46, vf); this.camera.updateProjectionMatrix();
  }
  results() {
    const P = this.player, N = this.racers.length, st = this.stats;
    // final rank = speed points (finish order) + answer points (100 each) + star bonus (10 each)
    const place = P.place || this.order.indexOf(P) + 1, nG = this.course.gates.length;
    const rest = this.racers.filter((r) => !r.finished).sort((a, b) => b.progress() - a.progress());
    const ptsOf = (r) => {
      const pl = r.finished ? r.place : this.finishCount + rest.indexOf(r) + 1; // racers still running keep their current order
      const okN = r.finished || !nG ? (r.quizOk || 0) : Math.min(nG, Math.round((r.quizOk || 0) + (nG - (r.quizN || 0)) * (r.quizN ? r.quizOk / r.quizN || 0 : 0.6)));
      const speed = Math.round(1000 * (N - pl) / Math.max(1, N - 1)), quiz = 100 * okN, star = r === P ? 10 * (st.stars || 0) : 0;
      return { speed, quiz, star, total: speed + quiz + star };
    };
    const pts = ptsOf(P); let rank = 1; for (const r of this.racers) if (r !== P && ptsOf(r).total > pts.total) rank++;
    const acc = st.attempts ? st.correct / st.attempts : 0;
    const avgSolve = st.solveTimes.length ? st.solveTimes.reduce((a, b) => a + b, 0) / st.solveTimes.length : 15;
    const speedScore = clamp(1 - (avgSolve - 3) / 12, 0, 1), finishScore = 1 - (rank - 1) / Math.max(1, N - 1);
    const score = pts.total;
    const rankBonus = rank === 1 ? 40 : rank <= 3 ? 25 : rank <= 10 ? 12 : 0;
    const energy = (st.energy + 20 + rankBonus + (st.maxCombo >= 3 ? 15 : 0)) * (this.subject === 'run' ? 2 : 1);
    const xp = 40 + st.correct * 15 + rankBonus + Math.round(score / 50);
    return { rank, place, pts, N, time: P.finishTime, correct: st.correct, attempts: st.attempts, acc, avgSolve, score, energy, xp, maxCombo: st.maxCombo, stomps: st.stomps, stars: st.stars || 0, stomped: st.stomped, log: st.log, worldId: this.worldId, level: this.level, subject: this.subject };
  }
  dispose() { this.course.dispose(); this.racers.forEach((r) => { r.view.bodyMat.dispose(); }); this.scene.clear(); $('#hud').classList.add('hidden'); $('#controls').classList.add('hidden'); $('#qpanel').classList.add('hidden'); }
}
const _m4 = new THREE.Matrix4();
function spawnTrail(P, kind, p) {
  const x = p.x + rand(-0.2, 0.2), y = p.y - 0.2, z = p.z + 0.4;
  if (kind === 'stars') P.spawn(x, y, z, 1, ['#ffe14d', '#fff7b0'], 0.6, 0.6, 0.35, -0.5, 0.5);
  if (kind === 'hearts') P.spawn(x, y, z, 1, ['#ff5fa2', '#ff9ccf'], 0.6, 0.6, 0.4, -0.5, 0.6);
  if (kind === 'bubbles') P.spawn(x, y, z, 1, ['#bff0ff', '#ffffff'], 0.4, 1.0, 0.45, -1.2, 0.3);
  if (kind === 'rainbow') P.spawn(x, y, z, 2, ['#ff5a7a', '#ff9a3c', '#ffd23f', '#5fd35f', '#3fc2ff', '#a86bff'], 0.3, 0.7, 0.4, 0, 0.2);
  if (kind === 'numbers') P.spawn(x, y, z, 1, ['#7fe7ff', '#fff38a'], 1.2, 0.5, 0.3, -1, 1);
}
function makeSky(top, bot, mid) {
  const g = new THREE.SphereGeometry(500, 32, 20);
  const u = { top: { value: new THREE.Color(top) }, bot: { value: new THREE.Color(bot) }, mid: { value: new THREE.Color(mid == null ? new THREE.Color(top).lerp(new THREE.Color(bot), 0.5) : mid) }, t: { value: 0 }, fx: { value: mid == null ? 0 : 1 } };
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 bot; uniform vec3 mid; uniform float t; uniform float fx; varying vec3 vP;',
      'void main(){',
      ' float h=clamp(vP.y*1.5+0.3,0.0,1.0);',
      ' vec3 c = h<0.5 ? mix(bot,mid,h*2.0) : mix(mid,top,(h-0.5)*2.0);',
      ' vec3 sd=normalize(vec3(0.0,0.18,-1.0)); float a=acos(clamp(dot(vP,sd),-1.0,1.0));',
      ' vec3 q=vP-sd*dot(vP,sd); float ang=atan(q.y,q.x);',
      ' float rays=smoothstep(0.55,1.0,sin(ang*12.0+t*0.25))*smoothstep(1.3,0.15,a)*0.22*fx;',
      ' float sun=smoothstep(0.14,0.10,a)*fx; float halo=smoothstep(0.6,0.0,a)*0.35*fx;',
      ' float band=smoothstep(0.06,0.0,abs(vP.y-0.02))*0.25*fx;',
      ' c += vec3(1.0,0.95,0.8)*(rays+halo+band); c=mix(c,vec3(1.0,0.98,0.85),sun);',
      ' gl_FragColor=vec4(c,1.0); }'].join('\n') });
  const s = new THREE.Mesh(g, m); s.renderOrder = -1; s.frustumCulled = false;
  s.onBeforeRender = (r, sc, cam) => { u.t.value = performance.now() / 1000; s.position.copy(cam.position); };
  return s;
}
function playerLook() {
  const S = Save.data, e = S.equip;
  const cs = COSTUMES[e.costume] || COSTUMES.none; const col = cs.color || (e.color === 'rainbow' ? 0xd99bff : COLORS[e.color].hex);
  return { costume: e.costume, crown: S.lastCrown, colorHex: col, pattern: e.pattern, face: e.face, tuft: TUFT_BY_LEVEL[S.profile ? S.profile.level : 1], hat: e.hat, glasses: e.glasses, outfit: e.outfit, wings: e.wings, bag: e.bag, shoes: e.shoes, scale: 0.62 };
}
