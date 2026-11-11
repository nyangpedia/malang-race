// ================================================================
// App: renderer, hub scene, screens & menus
// ================================================================
const DAILY = [
  { id: 'race1', label: '레이스 1번 완주', goal: 1, reward: 30 },
  { id: 'correct10', label: '관문 정답 10개', goal: 10, reward: 40 },
  { id: 'stomp3', label: '말랑이 3번 밟기', goal: 3, reward: 25 },
];
const App = {
  renderer: null, envMap: null, aspect: 1, race: null, paused: false, hub: null, last: 0,
  init() {
    const S = Save.load();
    const canvas = $('#gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0; this.renderer.shadowMap.enabled = S.settings.quality !== 'low'; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyQuality();
    initCharacterAssets();
    this.envMap = buildEnvMap(this.renderer);
    this.buildHub();
    addEventListener('resize', () => this.resize()); this.resize();
    Input.bind();
    $('#pausebtn').onclick = () => this.togglePause();
    $('#btn-start').onclick = () => { Sound.init(); Sound.play('click'); this.olStart(); };
    $('#btn-online').onclick = () => { Sound.init(); Sound.play('click'); this.olEntry(); };
    document.addEventListener('pointerdown', () => Sound.init(), { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.race && this.race.state === 'run' && !this.paused) this.togglePause(); });
    $('#loading').classList.add('hidden');
    this.show('title'); this.drawTitleOnline(); this.olBoot();
    requestAnimationFrame((t) => this.loop(t));
  },
  applyQuality() {
    const q = Save.data.settings.quality; const dpr = window.devicePixelRatio || 1;
    const auto = Math.min(dpr, (Math.min(innerWidth, innerHeight) < 600 ? 1.5 : 1.75));
    this.renderer.setPixelRatio(q === 'low' ? 1 : q === 'high' ? Math.min(dpr, 2) : auto);
  },
  resize() {
    Stage.update(); const w = Stage.w, h = Stage.h; this.aspect = w / h; this.renderer.setSize(w, h, false);
    if (this.hub) { this.hub.camera.aspect = this.aspect; this.hub.camera.updateProjectionMatrix(); this.placeHubCamera(); }
    if (this.race) { this.race.camera.aspect = this.aspect; this.race.camera.updateProjectionMatrix(); }
  },
  show(name) {
    for (const s of ['title', 'register', 'hub', 'map']) $('#screen-' + s).classList.toggle('hidden', s !== name);
    this.screen = name; this.drawFever && this.drawFever();
  },
  loop(t) {
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000); this.last = t;
    if (this.race) {
      if (!this.paused) this.race.update(dt);
      this.renderer.render(this.race.scene, this.race.camera);
      if (this.room) this.room.tick(dt);
    } else { this.updateHub(dt); this.renderer.render(this.hub.scene, this.hub.camera); }
    if (!document.hidden && Save.data.profile && this.screen !== 'title' && this.screen !== 'register') Online.tickPlay(dt);
    this._pollT = (this._pollT || 3) - dt; if (this._pollT <= 0) { this._pollT = 25; this.pollRooms(); }
    this.fps = this.fps ? this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05 : 60;
    requestAnimationFrame((tt) => this.loop(tt));
  },
  // ---------------- hub 3D ----------------
  buildHub() {
    const sc = new THREE.Scene(); sc.environment = this.envMap; sc.add(makeSky(0xa9d8ff, 0xffd9f0)); sc.fog = new THREE.Fog(0xffe4f4, 30, 120);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xd8c8ff, 1.2)); const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-5, 10, 8); sc.add(sun);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
    // stage
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.6, 48), jellyMaterial(0xffc2e2)); stage.position.y = -0.3; sc.add(stage);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.18, 10, 48), mat(0xffffff)); rim.rotation.x = Math.PI / 2; sc.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), mat(0xbfefb8, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; sc.add(ground);
    const course = { group: sc }; // decorations reuse
    const deco = Course.prototype.decoItem;
    for (let i = 0; i < 26; i++) { const o = deco.call({}, 'candy'); const a = rand(0, Math.PI * 2), r = rand(14, 40); o.position.set(Math.cos(a) * r, -0.6, Math.sin(a) * r - 10); sc.add(o); }
    const player = new MallangView(playerLookSafe(), true); player.root.scale.setScalar(1.25); sc.add(player.root);
    const friends = [];
    for (let i = 0; i < 6; i++) {
      const f = new MallangView({ colorHex: AI_COLORS[(i * 3 + 1) % AI_COLORS.length], face: pick(['happy', 'wink', 'normal', 'sparkle', 'sleepy']), tuft: pick(TUFTS), pattern: 'none', scale: 0.8 }, true);
      const a = -0.9 + i * 0.36; f.home = new THREE.Vector3(Math.sin(a) * 6.5, -0.6, -4 - Math.cos(a) * 3); f.root.position.copy(f.home); f.hopT = rand(0, 2); sc.add(f.root); friends.push(f);
      f.yaw.rotation.y = Math.atan2(-f.home.x, 6 - f.home.z);
    }
    this.hub = { scene: sc, camera: cam, player, friends, t: 0, zoom: 0 };
    this.placeHubCamera();
    // tap the mallang → boing
    $('#gl').addEventListener('pointerdown', (e) => {
      if (this.race || this.screen !== 'hub') return;
      const ndc = new THREE.Vector2(Stage.x(e) / Stage.w * 2 - 1, -(Stage.y(e) / Stage.h) * 2 + 1); const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, cam);
      if (rc.intersectObject(player.root, true).length) { player.vy0 = 7; player.stretch(0.4); player.setFace(pick(['joy', 'happy', 'heart', 'surprise']), 1.2); Sound.play('boing'); }
    });
  },
  placeHubCamera() {
    const H = this.hub, port = this.aspect < 0.9;
    const z = H.zoom ? (port ? 12.5 : 9) : (port ? 15 : 10.5), y = H.zoom ? (port ? 3.2 : 3) : 3.4;
    H.camTarget = new THREE.Vector3(0, y, z); H.lookTarget = new THREE.Vector3(0, H.zoom ? (port ? -1.2 : -0.6) : (port ? 0.0 : 1.3), 0);
    if (!H.camInit) { H.camera.position.copy(H.camTarget); H.camInit = true; }
  },
  updateHub(dt) {
    const H = this.hub; H.t += dt;
    const P = H.player; P.hy = (P.hy || 0) + (P.vy0 || 0) * dt; P.vy0 = (P.vy0 || 0) - 25 * dt; if (P.hy <= 0) { if ((P.vy0 || 0) < -3) P.land(0.4); P.hy = 0; P.vy0 = 0; }
    P.root.position.y = P.hy; P.yaw.rotation.y = Math.sin(H.t * 0.5) * 0.35; P.update(dt, 0, P.hy <= 0, false);
    for (const f of H.friends) { f.hopT -= dt; if (f.hopT <= 0) { f.hopT = rand(1.5, 4); f.vy0 = 6; f.stretch(0.3); } f.hy = (f.hy || 0) + (f.vy0 || 0) * dt; f.vy0 = (f.vy0 || 0) - 25 * dt; if (f.hy <= 0) { if (f.vy0 < -3) f.land(0.3); f.hy = 0; f.vy0 = 0; } f.root.position.y = f.home.y + f.hy; f.update(dt, 0, f.hy <= 0, false); }
    H.camera.position.lerp(H.camTarget, 1 - Math.exp(-4 * dt)); H.camera.position.y += Math.sin(H.t * 0.7) * 0.003;
    H._look = H._look || H.lookTarget.clone(); H._look.lerp(H.lookTarget, 1 - Math.exp(-4 * dt)); H.camera.lookAt(H._look);
  },
  refreshPlayerLook() { if (this.hub) this.hub.player.setLook(playerLookSafe()); },
  setHubZoom(z) { this.hub.zoom = z; this.placeHubCamera(); },
  // ---------------- register ----------------
  showRegister(edit) {
    this.show('register'); const S = Save.data; let age = S.profile ? S.profile.age : 7, level = S.profile ? S.profile.level : levelForAge(age), touched = !!S.profile;
    $('#reg-nick').value = S.profile ? S.profile.nick : '';
    const draw = () => {
      $('#reg-age').innerHTML = [6, 7, 8, 9, 10, 11, 12, 13].map((a) => `<button class="chip ${a === age ? 'on' : ''}" data-a="${a}">${a === 13 ? '13세+' : a + '세'}</button>`).join('');
      const rec = levelForAge(age);
      $('#reg-level').innerHTML = [1, 2, 3, 4, 5, 6].map((l) => `<button class="lvcard ${l === level ? 'on' : ''}" data-l="${l}">${l === rec ? '<span class="rec">추천</span>' : ''}<b>${LEVELS[l].icon} LV${l} ${LEVELS[l].name}</b><small>${LEVELS[l].ages} · ${LEVELS[l].desc}</small></button>`).join('');
      $$('#reg-age .chip').forEach((b) => (b.onclick = () => { age = +b.dataset.a; if (!touched) level = levelForAge(age); Sound.play('click'); draw(); }));
      $$('#reg-level .lvcard').forEach((b) => (b.onclick = () => { level = +b.dataset.l; touched = true; Sound.play('click'); draw(); }));
    };
    draw();
    $('#btn-reg').textContent = edit ? '저장하기' : '말랑 행성으로 출발!';
    $('#btn-reg').onclick = () => {
      const nick = $('#reg-nick').value.trim().replace(/[<>"'&]/g, '');
      if (nick.length < 2) { $('#reg-nick').focus(); $('#reg-nick').style.borderColor = '#ff5a7a'; return; }
      const prevLevel = S.profile ? S.profile.level : null;
      S.profile = Object.assign(S.profile || { createdAt: new Date().toISOString() }, { nick, age, level });
      Save.save(); Sound.play('correct'); this.refreshPlayerLook(); this.enterHub();
      if (prevLevel && prevLevel !== level) this.toastHub(`수학 레벨이 LV${level} ${LEVELS[level].name}(으)로 바뀌었어요`);
    };
  },
  // ---------------- hub UI ----------------
  enterHub() {
    this.show('hub'); this.setHubZoom(0); this.closeModal();
    this.checkDaily();
    this.drawHub();
    Sound.startMusic(MUSIC.hub);
  },
  checkDaily() {
    const S = Save.data, today = todayStr();
    if (S.daily.date !== today) { S.daily = { date: today, progress: {}, claimed: {} }; }
    if (S.attendance.last !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1); const ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      S.attendance.streak = S.attendance.last === ys ? S.attendance.streak + 1 : 1; S.attendance.last = today; S.attendance.days++;
      const reward = 20 + Math.min(S.attendance.streak, 7) * 5; S.energy += reward; S.energyEarned += reward; Save.save();
      setTimeout(() => !this.race && this.screen === 'hub' && this.modal(`<h2>📅 출석 보상</h2><p style="font-size:20px">오늘도 와 줘서 고마워요!<br>연속 출석 <b>${S.attendance.streak}일</b>째 · 총 ${S.attendance.days}일</p><div class="res-grid"><div>받은 숫자 에너지<b>+${reward} ⚡</b></div></div><div style="text-align:center"><button class="btn" onclick="App.closeModal();App.drawHub()">좋아요!</button></div>`), 300);
    }
    Save.save();
  },
  drawHub() {
    const S = Save.data, P = S.profile, al = accountLevel(S.xp), L = LEVELS[P.level];
    $('#hub-top').innerHTML = `<div class="pill me">🫧 <b>${escapeHtml(P.nick)}</b></div><div class="pill">말랑 Lv.${al.lv} <span class="xpbar"><i style="width:${al.cur / al.need * 100}%"></i></span></div><div class="pill">${L.icon} 수학 ${P.level}학년 ${L.name}</div><div class="pill">⚡ <b>${S.energy}</b></div>`;
    const missions = DAILY.map((m) => { const p = Math.min(m.goal, S.daily.progress[m.id] || 0), done = p >= m.goal, cl = S.daily.claimed[m.id]; return `<div class="mission"><span style="width:96px">${m.label}</span><span class="bar"><i style="width:${p / m.goal * 100}%"></i></span>${cl ? '✅' : done ? `<button class="btn sm green" data-claim="${m.id}">+${m.reward}</button>` : `<span class="muted">${p}/${m.goal}</span>`}</div>`; }).join('');
    $('#hub-daily').innerHTML = `<h4>오늘의 미션</h4>${missions}<div class="muted" style="margin-top:6px">출석 ${S.attendance.streak}일 연속 🔥</div>`;
    $$('[data-claim]').forEach((b) => (b.onclick = () => { const m = DAILY.find((x) => x.id === b.dataset.claim); S.daily.claimed[m.id] = true; S.energy += m.reward; S.energyEarned += m.reward; Save.save(); Sound.play('coin'); this.drawHub(); }));
    const promo = promotionStatus();
    const items = [
      ['race', '🏁', '레이스'], ['custom', '🎨', '꾸미기'], ['notes', '📒', '오답노트'], ['rank', '🏆', '랭킹'],
      ['level', '🎓', '레벨·승급'], ['shop', '🛍️', '상점'], ['map', '🗺️', '월드 지도'], ['settings', '⚙️', '설정'],
    ];
    $('#hub-menu').innerHTML = items.map(([id, ic, t]) => `<button class="mbtn" data-m="${id}"><span class="ic">${ic}</span>${t}${id === 'level' && promo.ready ? '<span class="dot"></span>' : ''}${id === 'notes' && S.wrongNotes.some((w) => !w.resolved) ? '<span class="dot" style="background:#ffb02e"></span>' : ''}</button>`).join('');
    $$('#hub-menu .mbtn').forEach((b) => (b.onclick = () => { Sound.play('click'); this.openMenu(b.dataset.m); }));
    $('#btn-race').onclick = () => { Sound.play('click'); this.openMenu('race'); };
  },
  toastHub(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2200); },
  modal(html, side = false) { const m = $('#modal'); m.classList.remove('hidden'); m.classList.toggle('side', side); document.body.classList.toggle('modal-side', side); $('#modal-panel').classList.remove('narrow'); $('#modal-panel').innerHTML = `<button class="x" onclick="App.closeModal()">✕</button>` + html; $('#modal-panel').scrollTop = 0; },
  closeModal() { $('#modal').classList.add('hidden'); document.body.classList.remove('modal-side'); if (this.hub && this.hub.zoom) this.setHubZoom(0); if (this.screen === 'hub' && Save.data.profile) this.drawHub(); },
  openMenu(id) {
    const fn = { race: 'menuRace', custom: 'menuCustom', notes: 'menuNotes', rank: 'menuRank', level: 'menuLevel', shop: 'menuShop', map: 'menuMap', settings: 'menuSettings' }[id];
    this[fn]();
  },
  // ---------------- race setup ----------------
  menuRace(sel) {
    const S = Save.data; let world = sel || this._lastWorld || 'candy'; if (!S.unlockedWorlds.includes(world)) world = 'candy'; const count = 50;
    const draw = () => {
      this.modal(`<h2>🏁 레이스 준비</h2>
      <div class="worlds">${WORLD_ORDER.map((w) => { const W = WORLDS[w], un = S.unlockedWorlds.includes(w); return `<button class="world w-${w} ${w === world ? 'on' : ''}" data-w="${w}"><b>${W.icon} ${W.name}</b><small>${W.topic} 테마</small>${un ? '' : `<span class="lock">🔒<span>${W.price} ⚡로 해금</span></span>`}</button>`; }).join('')}</div>
      <p class="muted">문제는 월드와 상관없이 내 수학 레벨(LV${S.profile.level} ${LEVELS[S.profile.level].name})에 맞춰 나와요.</p>
      <div class="mode"><div class="opt on"><b>🤖 AI 레이스</b><br><span class="muted">나 + AI 말랑이 · 이 기기에서 바로 플레이</span></div><div class="opt off"><b>🌐 온라인 대전</b><br><span class="muted">서버가 아직 연결되지 않아 이용할 수 없어요 (준비 중)</span></div></div>
      <p class="muted" style="text-align:center">참가 인원 <b>50명</b> (나 1명 + AI 말랑이 49명)</p>
      <div class="sticky" style="text-align:center"><button class="btn" id="go-race" style="font-size:24px;padding:14px 40px">출발하기!</button></div>`);
      $$('.world').forEach((b) => (b.onclick = () => { const w = b.dataset.w; if (!S.unlockedWorlds.includes(w)) { this.unlockWorld(w, () => { world = w; draw(); }); return; } world = w; Sound.play('click'); draw(); }));
      $('#go-race').onclick = () => { this._lastWorld = world; this.startRace(world, count); };
    };
    draw();
  },
  unlockWorld(w, after) {
    const S = Save.data, W = WORLDS[w];
    if (S.energy < W.price) { this.toastHub(`숫자 에너지가 ${W.price - S.energy}개 더 필요해요`); Sound.play('wrong'); return; }
    S.energy -= W.price; S.unlockedWorlds.push(w); Save.save(); Sound.play('finish'); this.toastHub(`${W.name} 해금! 🎉`); after && after();
  },
  startRace(worldId, count, subject, free, extra) {
    subject = subject || Save.data.settings.subject || 'math'; if (!SUBJECTS[subject]) subject = subject === 'capital' ? 'quiz' : 'math';
    if (!(extra && extra.room)) { if (this.room) this.leaveRoom(true); if (Online.timeLeft() <= 0) { this.olTimeUpModal(); return; } }
    if (subject === 'run' && !free) { const S = Save.data; if (!(S.runTickets > 0)) { this.closeModal(); this.enterHub(); return; } S.runTickets--; Save.save(); }
    $('#fever').classList.add('hidden'); $('#fever-mini').classList.add('hidden');
    this.closeModal(); this.show('none'); $('#screen-hub').classList.add('hidden');
    Sound.init(); Sound.startMusic(MUSIC[worldId]);
    if (this.race) this.race.dispose();
    this.race = new Race(Object.assign({ worldId, count, level: Save.data.profile.level, subject }, extra || {}));
    $('#roomcall').classList.add('hidden');
    this.race.camera.aspect = this.aspect; this.race.camera.updateProjectionMatrix();
    this.paused = false;
  },
  togglePause() {
    if (!this.race || this.race.state === 'done') return;
    this.paused = !this.paused;
    if (this.paused) this.modal(`<h2>⏸ 잠깐 쉬기</h2>${this.room ? '<p class="muted" style="text-align:center">친구 방에서는 쉬는 동안에도 친구들은 계속 달려요.</p>' : ''}<div style="display:flex;flex-direction:column;gap:12px;align-items:center"><button class="btn" onclick="App.togglePause()">계속 달리기</button>${this.room ? '' : '<button class="btn blue" onclick="App.restartRace()">처음부터 다시</button>'}<button class="btn gray" onclick="App.exitRace()">광장으로 나가기</button></div><p class="muted" style="text-align:center;margin-top:14px">PC: W A S D / 방향키로 이동, Space 점프<br>모바일: 왼쪽 조이스틱과 점프 버튼</p>`);
    else $('#modal').classList.add('hidden');
  },
  restartRace() { const r = this.race; this.paused = false; this.startRace(r.worldId, r.N, r.subject, r.state !== 'done'); },
  exitRace() { if (this.room) this.leaveRoom(true); $('#roomhud').classList.add('hidden'); $('#emotebar').classList.add('hidden'); this.paused = false; if (this.race) this.race.dispose(); this.race = null; this.enterHub(); },
  showResults(res) {
    const S = Save.data;
    S.lastCrown = res.rank === 1 ? 'gold' : res.rank === 2 ? 'silver' : res.rank === 3 ? 'bronze' : null; this.refreshPlayerLook();
    S.xp += res.xp; S.energy += res.energy; S.energyEarned += res.energy; S.stats.races++; if (res.rank === 1) S.stats.wins++; S.stats.stomps += res.stomps; S.bestCombo = Math.max(S.bestCombo, res.maxCombo);
    S.worldBest = S.worldBest || {}; { const b = S.worldBest[res.worldId]; if (!b || res.rank < b.rank) S.worldBest[res.worldId] = { rank: res.rank, time: res.time }; }
    S.history.unshift({ date: new Date().toISOString(), world: res.worldId, rank: res.rank, N: res.N, time: res.time, correct: res.correct, attempts: res.attempts, score: res.score, level: res.level });
    if (S.history.length > 200) S.history.length = 200;
    const dp = S.daily.progress; if (S.daily.date === todayStr()) { dp.race1 = (dp.race1 || 0) + 1; dp.correct10 = (dp.correct10 || 0) + res.correct; dp.stomp3 = (dp.stomp3 || 0) + res.stomps; }
    let tk = ''; if (res.subject !== 'run') { S.runProgress = (S.runProgress || 0) + 1; if (S.runProgress >= RUN_NEED) { S.runProgress = 0; S.runTickets = (S.runTickets || 0) + 1; S.feverSeen = false; tk = `<div class="fever-hero" style="margin:10px 0"><div class="big">🔥 피버 모드 열림!</div><p>레이스 ${RUN_NEED}판 완주 보상이에요. 문제 없이 달리고 에너지는 2배!</p><button class="btn" style="margin-top:10px;background:#fff;color:#ff5a3c;box-shadow:0 6px 0 #c9401f" onclick="App.startFever()">🔥 지금 참가하기</button></div>`; } else tk = `<p class="muted" style="text-align:center">🔥 피버 모드까지 ${S.runProgress}/${RUN_NEED}판</p>`; } else tk = `<p class="muted" style="text-align:center">🔥 남은 피버 참가권 ${S.runTickets || 0}장 · 일반 레이스 ${RUN_NEED}판마다 1장을 받아요</p>`;
    const inRoom = !!(this.room && this.race && this.race.room); Online.submitScore(res, inRoom).then((sc) => { if (sc && $('#res-online')) $('#res-online').innerHTML = `🏆 랭킹에 올렸어요 · 랭킹 점수 <b>${sc}점</b>`; });
    let tkTop = ''; if (tk.includes('fever-hero')) { tkTop = tk; tk = ''; }
    const again = res.subject === 'run' && !(S.runTickets > 0) ? '' : `<button class="btn" onclick="App.restartRace();App.closeModal()">${res.subject === 'run' ? '🔥 피버 한 번 더!' : '한 번 더!'}</button>`;
    Save.save();
    const tm = `${Math.floor(res.time / 60)}분 ${Math.floor(res.time % 60)}초`;
    const pts = res.pts || { speed: 0, quiz: 0, star: 0, total: res.score };
    this.modal(`<h2>${res.subject === 'run' ? '🔥 피버 모드 결과' : '🏁 레이스 결과'}</h2><div class="res-rank">${res.rank}등 <span style="font-size:26px;color:#a77bd0;-webkit-text-stroke:0;text-shadow:none">/ ${res.N}명</span></div>${inRoom ? '<div class="wn room-board" id="room-board"></div>' : ''}${tkTop}
      <div class="res-pts"><div>🏃 속도<b>${pts.speed}</b><small>${res.place || res.rank}번째 골인 · ${tm}</small></div><i>+</i><div>✏️ 정답<b>${pts.quiz}</b><small>${res.subject === 'run' ? '문제 없음' : res.correct + ' / ' + res.attempts + ' 문제'}</small></div><i>+</i><div>⭐ 별<b>${pts.star}</b><small>${res.stars || 0}개</small></div><i>=</i><div class="sum">합계<b>${pts.total}</b><small>포인트</small></div></div>
      <div class="res-mini"><span>최대 콤보 <b>${res.maxCombo}</b></span><span>밟기 <b>${res.stomps}</b></span><span>에너지 <b style="color:#d89a00">+${res.energy} ⚡</b></span><span>경험치 <b style="color:#d8407f">+${res.xp} XP</b></span></div>
      ${Online.child ? '<div class="muted" id="res-online" style="text-align:center">☁️ 기록 저장 중…</div>' : ''}
      ${S.lastCrown ? `<div class="wn" style="text-align:center;font-size:18px">👑 ${res.rank}등 축하해요! 다음 판에는 <b>${CROWN_TIERS[S.lastCrown][1]}왕관</b>을 쓰고 달려요.</div>` : ''}${tk}<p class="muted" style="text-align:center">${res.subject === 'run' ? '피버 모드는 문제 없이 달리고 에너지를 2배로 받아요.' : res.attempts > res.correct ? `틀린 문제 ${res.attempts - res.correct}개는 📒 오답노트에서 다시 볼 수 있어요.` : '등수는 속도, 정답, 별 포인트를 더해서 정해요.'}</p>
      <div class="row" style="justify-content:center;margin-top:10px">${inRoom ? '<button class="btn" onclick="App.roomBackToLobby()">👫 방으로 돌아가기</button>' : again}<button class="btn blue" onclick="App.exitRace()">${inRoom ? '방 나가기' : '광장으로'}</button></div>`);
  },
  // ---------------- customize & shop ----------------
  catList() { return [['costume', '변신'], ['color', '색상'], ['pattern', '패턴'], ['face', '표정'], ['hat', '모자'], ['glasses', '안경'], ['outfit', '의상'], ['wings', '날개'], ['bag', '가방'], ['shoes', '신발'], ['trail', '이동 효과']]; },
  idsOf(cat) { if (cat === 'costume') return Object.keys(COSTUMES); if (cat === 'color') return Object.keys(COLORS); if (cat === 'pattern') return Object.keys(PATTERNS.list); if (cat === 'face') return Object.keys(FACES.list); return Object.keys(ITEMS[cat].items); },
  itemIcon(cat, id) {
    if (cat === 'costume') return `<span style="font-size:28px">${COSTUMES[id].icon}</span>`;
    if (cat === 'color') return `<span class="sw" style="background:${id === 'rainbow' ? 'linear-gradient(135deg,#ff9ccf,#9be3ff,#ffe17a)' : '#' + COLORS[id].hex.toString(16).padStart(6, '0')}"></span>`;
    const ic = { pattern: { none: '⚪', dots: '🫧', stripes: '〰️', stars: '⭐', hearts: '💗', swirl: '🌀' }, face: { normal: '🙂', happy: '😄', wink: '😉', sparkle: '🤩', cool: '😎', heart: '😍', sleepy: '😪', determined: '😤' }, hat: { none: '⚪', crown: '👑', beanie: '🧶', party: '🥳', flower: '🌸', wizard: '🧙', cap: '🧢', headphone: '🎧' }, glasses: { none: '⚪', round: '👓', sun: '🕶️', heart: '💕', star: '🌟' }, outfit: { none: '⚪', bowtie: '🎀', scarf: '🧣', cape: '🦸', medal: '🥇' }, wings: { none: '⚪', angel: '☁️', butterfly: '🦋', jelly: '🐟' }, bag: { none: '⚪', backpack: '🎒', star: '⭐', rocket: '🚀' }, shoes: { none: '⚪', sneakers: '👟', boots: '🥾', roller: '🛼' }, trail: { none: '⚪', stars: '✨', hearts: '💖', bubbles: '🫧', rainbow: '🌈', numbers: '🔢' } };
    return `<span style="font-size:28px">${(ic[cat] && ic[cat][id]) || '🎁'}</span>`;
  },
  menuCustom(cat = 'costume') {
    this.setHubZoom(1); const S = Save.data;
    const ids = this.idsOf(cat);
    const html = `<h2>🎨 말랑이 꾸미기</h2><div class="tabs">${this.catList().map(([c, n]) => `<button class="tab ${c === cat ? 'on' : ''}" data-c="${c}">${n}</button>`).join('')}</div>
      <div class="grid">${ids.map((id) => { const own = S.owned.includes(cat + ':' + id) || itemPrice(cat, id) === 0, on = S.equip[cat] === id; return `<button class="item ${on ? 'on' : ''} ${own ? '' : 'locked'}" data-i="${id}">${this.itemIcon(cat, id)}<span>${itemName(cat, id)}</span>${own ? (on ? '<span class="tag green">착용 중</span>' : '') : `<span class="pr">🔒 ${itemPrice(cat, id)} ⚡</span>`}</button>`; }).join('')}</div>
      <p class="muted">아이템은 모양만 바뀌고 달리기 능력에는 영향을 주지 않아요. 머리 위 새싹은 수학 레벨이 오르면 자라나요 (새싹 → 잎새 → 꽃 → 별).</p>`;
    this.modal(html, true);
    $$('.tab').forEach((b) => (b.onclick = () => { Sound.play('click'); this.menuCustom(b.dataset.c); }));
    $$('.item').forEach((b) => (b.onclick = () => {
      const id = b.dataset.i, own = S.owned.includes(cat + ':' + id) || itemPrice(cat, id) === 0;
      if (!own) { this.buyItem(cat, id, () => this.menuCustom(cat)); return; }
      S.equip[cat] = id; Save.save(); Sound.play('click'); this.refreshPlayerLook(); this.hub.player.stretch(0.3); this.hub.player.setFace('happy', 0.8); this.menuCustom(cat);
    }));
  },
  buyItem(cat, id, after) {
    const S = Save.data, price = itemPrice(cat, id);
    if (S.energy < price) { this.toastHub(`숫자 에너지가 ${price - S.energy}개 부족해요. 레이스에서 정답을 맞혀 모아요!`); Sound.play('wrong'); return; }
    S.energy -= price; S.owned.push(cat + ':' + id); S.equip[cat] = id; Save.save(); Sound.play('coin'); this.refreshPlayerLook(); this.toastHub(`${itemName(cat, id)} 구매 완료! 바로 착용했어요`); after && after();
  },
  menuShop(cat = 'costume') {
    this.setHubZoom(1); const S = Save.data;
    const ids = this.idsOf(cat).filter((id) => itemPrice(cat, id) > 0);
    this.modal(`<h2>🛍️ 보상 상점 <span class="pill" style="font-size:16px">⚡ ${S.energy}</span></h2><div class="tabs">${this.catList().map(([c, n]) => `<button class="tab ${c === cat ? 'on' : ''}" data-c="${c}">${n}</button>`).join('')}</div>
      <div class="grid">${ids.map((id) => { const own = S.owned.includes(cat + ':' + id); return `<button class="item ${own ? 'on' : ''}" data-i="${id}">${this.itemIcon(cat, id)}<span>${itemName(cat, id)}</span>${own ? '<span class="tag green">보유</span>' : `<span class="pr">${itemPrice(cat, id)} ⚡</span>`}</button>`; }).join('')}</div>
      <p class="muted">숫자 에너지는 레이스 정답, 콤보, 완주, 출석, 일일 미션으로 모을 수 있어요. 유료 아이템이나 능력치 아이템은 없어요.</p>`, true);
    $$('.tab').forEach((b) => (b.onclick = () => { Sound.play('click'); this.menuShop(b.dataset.c); }));
    $$('.item').forEach((b) => (b.onclick = () => { const id = b.dataset.i; if (S.owned.includes(cat + ':' + id)) { S.equip[cat] = id; Save.save(); this.refreshPlayerLook(); this.toastHub('착용했어요'); return; } this.buyItem(cat, id, () => this.menuShop(cat)); }));
  },
  // ---------------- wrong-answer notebook ----------------
  menuNotes(tab = 'list') {
    const S = Save.data; const open = S.wrongNotes.filter((w) => !w.resolved);
    const tabs = `<div class="tabs"><button class="tab ${tab === 'list' ? 'on' : ''}" data-t="list">틀린 문제 (${open.length})</button><button class="tab ${tab === 'stats' ? 'on' : ''}" data-t="stats">유형별 분석</button><button class="tab ${tab === 'done' ? 'on' : ''}" data-t="done">해결한 문제</button></div>`;
    let body = '';
    if (tab === 'list' || tab === 'done') {
      const list = tab === 'list' ? open : S.wrongNotes.filter((w) => w.resolved);
      body = list.length ? list.slice(0, 60).map((w) => `<div class="wn"><div class="meta"><span class="tag">${QTYPES[w.type] ? QTYPES[w.type].name : w.type}</span>${w.count > 1 ? `<span class="tag red">반복 오답 ${w.count}회</span>` : ''}${w.resolved ? '<span class="tag green">해결!</span>' : ''} ${new Date(w.date).toLocaleDateString('ko-KR')}</div><div class="q">${escapeHtml(w.text)}</div><div>내가 고른 답: <b style="color:#d0304f">${escapeHtml(w.chosen)}</b> · 정답: <b style="color:#1f8a5a">${escapeHtml(w.answer)}</b></div><div class="muted">💡 ${escapeHtml(w.explain)}</div>${tab === 'list' ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-retry="${w.id}">다시 풀기</button><button class="btn sm blue" data-sim="${w.type}">비슷한 유형 연습</button></div>` : ''}</div>`).join('') : `<p style="text-align:center;font-size:18px;padding:20px">${tab === 'list' ? '틀린 문제가 없어요! 🎉<br><span class="muted">레이스 관문에서 처음 고른 문이 오답이면 여기에 저장돼요.</span>' : '아직 해결한 문제가 없어요.'}</p>`;
    } else {
      const types = Object.keys(QTYPES).filter((id) => S.stats.byType[id] && S.stats.byType[id].a > 0);
      const rows = types.map((id) => ({ id, ...S.stats.byType[id], acc: S.stats.byType[id].c / S.stats.byType[id].a })).sort((a, b) => a.acc - b.acc);
      const t = S.stats.total;
      body = `<p style="font-size:18px">전체 정답률 <b>${t.a ? Math.round(t.c / t.a * 100) : 0}%</b> (${t.c}/${t.a})</p>` + (rows.length ? rows.map((r) => `<div class="statbar"><span style="width:150px">${QTYPES[r.id].name}</span><span class="b"><i style="width:${r.acc * 100}%;background:${r.acc < 0.6 ? '#ff5a7a' : r.acc < 0.85 ? '#ffc21f' : '#2fbf7f'}"></i></span><span style="width:86px;text-align:right">${Math.round(r.acc * 100)}% (${r.a})</span></div>`).join('') + `<p class="muted">빨간색은 더 연습이 필요한 취약 유형이에요. ${rows[0] && rows[0].acc < 0.85 ? `<button class="btn sm blue" data-sim="${rows[0].id}">${QTYPES[rows[0].id].name} 연습하기</button>` : ''}</p>` : '<p class="muted">아직 기록이 없어요. 레이스에서 관문을 통과해 보세요!</p>');
    }
    this.modal(`<h2>📒 나의 오답노트</h2>${tabs}${body}`);
    $$('[data-t]').forEach((b) => (b.onclick = () => this.menuNotes(b.dataset.t)));
    $$('[data-retry]').forEach((b) => (b.onclick = () => { const w = S.wrongNotes.find((x) => x.id === b.dataset.retry); this.retryNote(w); }));
    $$('[data-sim]').forEach((b) => (b.onclick = () => { const k = b.dataset.sim, T = QTYPES[k], sj = k === '수도 퀴즈' ? 'capital' : k === '영어 단어' ? 'english' : 'quiz'; this.quiz({ title: `${T ? T.name : k} 연습`, n: 5, gen: () => (T ? makeQuestion(T.level, k) : makeQuizQuestion(sj, S.profile.level)), mode: 'practice', back: () => this.menuNotes('list') }); }));
  },
  retryNote(w) {
    // rebuild a question object for the stored text/answer
    const q = { text: w.text, answer: w.answer, explain: w.explain, type: w.type, level: w.level };
    if (!QTYPES[w.type]) { q.textAnswer = true; q.wrongs = [w.chosen, ...(w.opts || [])].filter((x, i, a) => x && x !== w.answer && a.indexOf(x) === i).slice(0, 3); this.quiz({ title: '다시 풀기', n: 1, fixed: [q], mode: 'retry', onCorrect: () => { w.resolved = true; Save.save(); }, back: () => this.menuNotes('list') }); return; }
    const fresh = makeQuestion(w.level || 1, w.type); // borrow plausible distractors from the same type
    const wr = [w.chosen, ...fresh.wrongs].filter((x, i, a) => a.indexOf(x) === i && Math.abs(fracVal(x) - fracVal(w.answer)) > 1e-9).slice(0, 3);
    q.wrongs = wr;
    this.quiz({ title: '다시 풀기', n: 1, fixed: [q], mode: 'retry', onCorrect: () => { w.resolved = true; Save.save(); }, back: () => this.menuNotes('list') });
  },
  // generic 4-choice quiz (practice / retry / promotion exam)
  quiz(cfg) {
    const S = Save.data; let i = 0, score = 0; const qs = cfg.fixed || Array.from({ length: cfg.n }, () => cfg.gen());
    const step = () => {
      if (i >= qs.length) return finish();
      const q = qs[i], ch = cfg.fixed ? shuffle([q.answer, ...q.wrongs]) : choices4(q);
      this.modal(`<h2>${cfg.title}</h2><p class="muted">${i + 1} / ${qs.length}${cfg.mode === 'exam' ? ` · 맞힌 개수 ${score}` : ''}</p><div class="wn" style="text-align:center"><div class="q" style="font-size:30px">${escapeHtml(q.text)}</div></div><div class="choices">${ch.map((c) => `<button class="choice" data-c="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}</div><div id="qfb" style="margin-top:10px;min-height:44px"></div>`);
      let answered = false;
      $$('.choice').forEach((b) => (b.onclick = () => {
        if (answered) return; answered = true; const c = b.dataset.c, ok = isCorrect(q, c);
        if (cfg.mode !== 'exam' || true) recordAnswer(q, c, ok, cfg.mode);
        b.classList.add(ok ? 'ok' : 'no'); if (!ok) $$('.choice').forEach((x) => { if (isCorrect(q, x.dataset.c)) x.classList.add('ok'); });
        if (ok) { score++; Sound.play('correct'); cfg.onCorrect && cfg.onCorrect(q); } else Sound.play('wrong');
        Save.save();
        $('#qfb').innerHTML = `<div class="muted" style="font-size:16px">${ok ? '정답이에요! 🎉' : '아쉬워요!'} 💡 ${escapeHtml(q.explain)}</div><div style="text-align:right;margin-top:8px"><button class="btn sm" id="qnext">${i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button></div>`;
        $('#qnext').onclick = () => { i++; step(); };
      }));
    };
    const finish = () => {
      if (cfg.mode === 'exam') return cfg.done(score, qs.length);
      const gain = score * 3; S.energy += gain; S.energyEarned += gain; Save.save();
      this.modal(`<h2>${cfg.title} 결과</h2><div class="res-rank">${score} / ${qs.length}</div><p style="text-align:center">연습 보상 +${gain} ⚡</p><div style="text-align:center"><button class="btn" id="qback">돌아가기</button></div>`);
      $('#qback').onclick = () => (cfg.back ? cfg.back() : this.closeModal());
    };
    step();
  },
  // ---------------- ranking (local records) ----------------
  menuRank() {
    const S = Save.data; const h = S.history;
    const week = Date.now() - 7 * 864e5;
    const best = h.slice().sort((a, b) => b.score - a.score).slice(0, 10);
    const wk = h.filter((x) => new Date(x.date).getTime() >= week).sort((a, b) => b.score - a.score).slice(0, 5);
    const row = (x, i) => `<div class="wn" style="padding:8px 12px;display:flex;gap:10px;align-items:center"><b style="font-size:22px;width:30px;color:#ff5fa2">${i + 1}</b><span style="flex:1">${escapeHtml(S.profile.nick)} · ${WORLDS[x.world].icon} ${x.rank}등/${x.N} · 정답 ${x.correct}/${x.attempts} · LV${x.level}</span><b>${x.score}점</b></div>`;
    this.modal(`<h2>🏆 랭킹</h2>
      <div class="honest">전체 · 같은 나이 · 같은 학년 · 같은 레벨 · 친구 랭킹은 온라인 서버가 연결되어야 제공돼요. 지금은 <b>서버 미연결</b> 상태라 이 기기의 내 기록만 보여줘요.</div>
      <h3>이번 주 내 최고 기록</h3>${wk.length ? wk.map(row).join('') : '<p class="muted">이번 주 기록이 없어요.</p>'}
      <h3>역대 내 최고 기록</h3>${best.length ? best.map(row).join('') : '<p class="muted">레이스를 완주하면 기록이 쌓여요.</p>'}
      <p class="muted">점수 = 정답률 50% + 문제 풀이 속도 20% + 완주 순위 30%, 높은 수학 레벨일수록 난이도 보정(+15%/레벨). 랭킹에는 닉네임만 표시해요.</p>
      <p class="muted">총 ${S.stats.races}회 완주 · 1등 ${S.stats.wins}회 · 밟기 ${S.stats.stomps}회 · 최고 콤보 ${S.bestCombo}</p>`);
  },
  // ---------------- level & promotion exam ----------------
  menuLevel() {
    const S = Save.data, st = promotionStatus(), L = LEVELS[st.level];
    const per = st.per.map((p) => `<div class="statbar"><span style="width:170px">${p.name}</span><span class="b"><i style="width:${p.acc * 100}%;background:${p.ok ? '#2fbf7f' : '#ffc21f'}"></i></span><span style="width:90px;text-align:right">${p.a ? Math.round(p.acc * 100) + '%' : '-'} (${p.a})</span></div>`).join('');
    this.modal(`<h2>🎓 레벨 · 승급시험</h2><div class="wn"><div class="q">${L.icon} LV${st.level} ${L.name}</div><div class="muted">${L.desc}</div></div>
      <h3>유형별 숙련도</h3>${per}
      ${st.max ? '<p style="font-size:18px">최고 레벨 마스터예요! 👑</p>' : `<h3>승급시험 조건 (LV${st.level + 1} ${LEVELS[st.level + 1].name})</h3>${st.conds.map((c) => `<div style="font-size:16px;margin:4px 0">${c.ok ? '✅' : '⬜'} ${c.label}</div>`).join('')}<div style="font-size:16px;margin:4px 0">🎯 시험: 10문제 중 9문제 이상 정답</div>
      <div style="text-align:center;margin-top:12px"><button class="btn yellow" id="exam" ${st.ready ? '' : 'disabled'}>승급시험 보기</button></div><p class="muted" style="text-align:center">시험에 떨어져도 레벨과 아이템은 그대로예요. 언제든 다시 도전할 수 있어요.</p>`}
      <p class="muted">레이스 순위가 아니라 문제 풀이 실력으로만 레벨이 올라가요. 레벨은 설정에서 직접 바꿀 수도 있어요.</p>`);
    const b = $('#exam'); if (b) b.onclick = () => this.exam();
  },
  exam() {
    const S = Save.data, L = S.profile.level; const types = TYPES_BY_LEVEL[L];
    S.promo.attempts++; Save.save();
    this.quiz({ title: `LV${L + 1} 승급시험`, n: 10, gen: (() => { let k = 0; return () => makeQuestion(L, types[k++ % types.length]); })(), mode: 'exam', done: (score, n) => {
      const pass = score >= 9; S.promo.history.push({ date: new Date().toISOString(), level: L, score, pass });
      if (pass) {
        S.profile.level = L + 1; const prize = ['hat:party', 'outfit:medal', 'wings:angel', 'hat:wizard', 'hat:crown'][L - 1]; if (prize && !S.owned.includes(prize)) S.owned.push(prize); S.energy += 100; S.energyEarned += 100; Save.save(); this.refreshPlayerLook(); Sound.play('finish');
        this.modal(`<h2>🎉 승급 성공!</h2><div class="res-rank">${score} / ${n}</div><p style="text-align:center;font-size:20px">LV${L + 1} ${LEVELS[L + 1].name}이 되었어요!<br>머리 위 장식이 자라났어요. 특별 아이템 <b>${prize ? itemName(prize.split(':')[0], prize.split(':')[1]) : ''}</b> + 100 ⚡</p><div style="text-align:center"><button class="btn" onclick="App.closeModal()">최고야!</button></div>`);
      } else { Save.save(); Sound.play('wrong'); this.modal(`<h2>아쉬워요!</h2><div class="res-rank">${score} / ${n}</div><p style="text-align:center;font-size:18px">9문제 이상 맞히면 승급해요. 레벨과 아이템은 그대로예요.<br>틀린 문제는 오답노트에서 복습할 수 있어요.</p><div style="text-align:center"><button class="btn" onclick="App.menuLevel()">돌아가기</button></div>`); }
    } });
  },
  // ---------------- world map ----------------
  menuMap() {
    const S = Save.data;
    this.modal(`<h2>🗺️ 말랑 행성 지도</h2><p class="muted">숫자 에너지를 모아 새로운 월드를 되살려요!</p>
      <div class="worlds">${WORLD_ORDER.map((w, i) => { const W = WORLDS[w], un = S.unlockedWorlds.includes(w); return `<button class="world w-${w}" data-w="${w}"><b>${i + 1}. ${W.icon} ${W.name}</b><small>${W.topic} 테마<br>${{ candy: '사탕 발판 · 젤리 범퍼 · 초콜릿 미끄럼틀 · 점프대', block: '움직이는 블록 · 회전 장애물 · 무너지는 다리', cloud: '바람 구간 · 움직이는 구름 발판 · 공중 점프', crystal: '레이저 · 수정 기둥 · 움직이는 발판 · 복합 장애물' }[w]}</small>${un ? '' : `<span class="lock">🔒<span>${W.price} ⚡로 해금</span></span>`}</button>`; }).join('')}</div>
      <p class="muted">내 숫자 에너지: ⚡ ${S.energy} · 누적 획득 ${S.energyEarned}</p>`);
    $$('.world').forEach((b) => (b.onclick = () => { const w = b.dataset.w; if (S.unlockedWorlds.includes(w)) this.menuRace(w); else this.unlockWorld(w, () => this.menuMap()); }));
  },
  // ---------------- settings ----------------
  menuSettings() {
    const S = Save.data, st = S.settings;
    const sw = (k, label) => `<div class="switch"><span>${label}</span><button class="btn sm ${st[k] ? 'green' : 'gray'}" data-k="${k}">${st[k] ? '켜짐' : '꺼짐'}</button></div>`;
    this.modal(`<h2>⚙️ 설정</h2>${sw('sound', '효과음')}${sw('music', '배경음악')}
      <div class="switch"><span>그래픽 품질</span><span class="row">${[['auto', '자동'], ['high', '고화질'], ['low', '절약']].map(([k, n]) => `<button class="btn sm ${st.quality === k ? '' : 'gray'}" data-q="${k}">${n}</button>`).join('')}</span></div>
      <div class="switch"><span>프로필 (닉네임 · 나이 · 수학 레벨)</span><button class="btn sm blue" id="edit-prof">바꾸기</button></div>
      <div class="switch"><span>보호자 · 온라인 계정</span>${!Online.enabled ? '<span class="muted">이 버전은 서버가 연결되지 않았어요</span>' : Online.session ? '<span class="row"><button class="btn sm blue" id="st-parent">보호자 메뉴</button><button class="btn sm" id="st-kids">아이 바꾸기</button></span>' : '<button class="btn sm blue" id="st-login">보호자 계정 연결</button>'}</div>
      <div class="switch"><span>데이터 초기화</span><button class="btn sm gray" id="reset">초기화</button></div>
      <div class="honest">${Online.child ? `저장: <b>${escapeHtml(Online.child.nickname)}</b>의 기록은 이 기기와 서버에 함께 저장돼요. 친구 방에서는 보호자님이 승인한 친구와 실시간으로 달리고, 대화는 이모티콘만 돼요. 일반 레이스의 다른 말랑이는 AI예요.` : '저장: 지금은 이 기기 브라우저에만 저장돼요. 보호자 계정으로 하면 서버에 저장되고 친구 방을 쓸 수 있어요. 일반 레이스의 다른 말랑이는 AI예요.'}</div>
      <p class="muted">평균 프레임: ${Math.round(this.fps || 0)} FPS</p>`);
    $$('[data-k]').forEach((b) => (b.onclick = () => { st[b.dataset.k] = !st[b.dataset.k]; Save.save(); Sound.init(); Sound.applySettings(); this.menuSettings(); }));
    $$('[data-q]').forEach((b) => (b.onclick = () => { st.quality = b.dataset.q; Save.save(); this.applyQuality(); this.renderer.shadowMap.enabled = st.quality !== 'low'; this.resize(); this.menuSettings(); }));
    $('#edit-prof').onclick = () => { this.closeModal(); this.showRegister(true); };
    if ($('#st-parent')) $('#st-parent').onclick = () => this.olPin(() => this.olParent());
    if ($('#st-kids')) $('#st-kids').onclick = () => this.olPin(() => this.olPickChild(), '아이 바꾸기');
    if ($('#st-login')) $('#st-login').onclick = () => this.olEntry();
    $('#reset').onclick = () => { const b = $('#reset'); if (b.dataset.sure) { Save.reset(); Save.save(true); setTimeout(() => location.reload(), 900); } else { b.dataset.sure = 1; b.textContent = '정말 지울까요? 한 번 더 누르기'; b.classList.remove('gray'); } };
  },
};
function playerLookSafe() { if (!Save.data.profile) return { colorHex: COLORS.pink.hex, pattern: 'none', face: 'normal', tuft: 'sprout', scale: 0.62 }; return playerLook(); }
function buildEnvMap(renderer) {
  const pm = new THREE.PMREMGenerator(renderer); const sc = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 p; void main(){p=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec3 p; void main(){ vec3 a=vec3(1.0,0.86,0.95), b=vec3(0.62,0.82,1.0); gl_FragColor=vec4(mix(a,b,clamp(p.y*0.8+0.5,0.,1.))*1.1,1.);}' }));
  sc.add(sky);
  const lm = new THREE.MeshBasicMaterial({ color: 0xffffff }); lm.color.multiplyScalar(6);
  for (const [x, y, z, s] of [[-20, 30, 20, 10], [25, 18, -10, 6], [0, 40, -25, 8]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.5, s), lm); b.position.set(x, y, z); b.lookAt(0, 0, 0); sc.add(b); }
  const rt = pm.fromScene(sc, 0.02); pm.dispose(); return rt.texture;
}
window.addEventListener('load', () => { try { App.init(); } catch (e) { console.error(e); $('#loading').textContent = '앗! 이 브라우저에서 3D를 시작하지 못했어요: ' + e.message; } });
