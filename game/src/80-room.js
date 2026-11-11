// ================================================================
// Friend rooms: up to 8 real players (only the host's guardian-approved friends) race together;
// AI mallangs fill the rest of the grid. Talk is preset emotes only.
// Every player runs their own race on the same course (shared seed + the host's course level) and
// sees the friends as live "ghosts"; questions follow each child's own grade.
// ================================================================
const EMOTES = ['😀', '😂', '😮', '😢', '😡', '👍', '🎉', '❤️'];
const ROOM_MAX = 8, ROOM_HZ = 6;

// run fn with Math.random replaced by a seeded generator (so every client builds the same course)
const MAPS_PER_LEVEL = 30;
function mapSeed(world, level, no) { return 100000 + WORLD_ORDER.indexOf(world) * 10000 + level * 1000 + no * 7; }
function withSeed(seed, fn) {
  if (!seed) return fn();
  let a = seed >>> 0; const orig = RNG;
  RNG = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { return fn(); } finally { RNG = orig; }
}
const _emoTex = {};
function emoteSprite(e) {
  if (!_emoTex[e]) _emoTex[e] = canvasTex(128, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 60, 54, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(52, 108); g.lineTo(64, 126); g.lineTo(76, 108); g.fill(); g.font = '68px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 64); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _emoTex[e], transparent: true, depthWrite: false, depthTest: false })); s.scale.set(1.3, 1.3, 1); s.renderOrder = 9; return s;
}
function nameSprite(text, color = '#4a2a6a') {
  const tex = canvasTex(256, 64, (g) => { g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect ? g.roundRect(4, 6, 248, 52, 26) : g.rect(4, 6, 248, 52); g.fill(); g.font = `bold 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text.slice(0, 10), 128, 34); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(2.2, 0.55, 1); s.renderOrder = 6; return s;
}

class Room {
  constructor(code, isHost, hostNick) {
    this.code = code; this.isHost = isHost; this.hostNick = hostNick || '';
    this.key = Math.random().toString(36).slice(2, 10); this.joined = Date.now();
    this.members = []; this.ghosts = new Map(); this.fins = {}; this.bubbles = {};
    this.st = 'lobby'; this.world = 'candy'; this.subject = Save.data.settings.subject && Save.data.settings.subject !== 'run' ? Save.data.settings.subject : 'math';
    this.sendT = 0; this.emoT = 0; this.hudT = 0;
  }
  async connect() {
    const sb = Online.sb;
    try { if (sb.realtime && sb.realtime.setAuth) await sb.realtime.setAuth(); } catch (e) { /* older client: token is already set */ }
    const ch = sb.channel('room:' + this.code, { config: { private: true, broadcast: { self: false }, presence: { key: this.key } } }); this.ch = ch;
    ch.on('presence', { event: 'sync' }, () => this.onSync());
    ch.on('broadcast', { event: 'm' }, (m) => this.onMsg((m && m.payload) || {}));
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('timeout')), 12000);
      ch.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') { clearTimeout(to); try { await this.track(); } catch (e) {} res(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { clearTimeout(to); rej(err || new Error(status)); }
      });
    });
  }
  meta() { return { nick: Save.data.profile.nick, look: playerLookSafe(), host: this.isHost, st: this.st, at: this.joined, lvl: Save.data.profile.level }; }
  track() { return this.ch ? this.ch.track(this.meta()) : null; }
  setState(st) { this.st = st; this.track(); }
  onSync() {
    const ps = this.ch.presenceState(), list = [];
    for (const k in ps) { const arr = ps[k]; const m = arr && arr[arr.length - 1]; if (m) list.push(Object.assign({ key: k }, m)); }
    list.sort((a, b) => a.at - b.at); this.members = list;
    if (list.findIndex((m) => m.key === this.key) >= ROOM_MAX) { App.leaveRoom(true); App.modal('<h2>👫 방이 꽉 찼어요</h2><p>친구 방에는 8명까지 들어갈 수 있어요.</p><button class="btn" onclick="App.closeModal()">알겠어요</button>'); return; }
    if (!this.isHost) {
      clearTimeout(this._nhT);
      if (!list.some((m) => m.host)) this._nhT = setTimeout(() => { if (App.room === this && !this.members.some((m) => m.host)) { App.leaveRoom(true); if (!App.race) App.modal('<h2>👫 방이 닫혔어요</h2><p>방장이 방을 나갔어요.</p><button class="btn" onclick="App.closeModal()">알겠어요</button>'); else App.race.toast('방장이 방을 나갔어요'); } }, 8000);
    }
    App.roomRefresh();
  }
  send(p) { if (!this.ch) return; p.k = this.key; try { this.ch.send({ type: 'broadcast', event: 'm', payload: p }); } catch (e) {} }
  onMsg(p) {
    if (!p.k || p.k === this.key) return;
    const from = this.members.find((m) => m.key === p.k);
    if (p.t === 'start') { if (from && from.host) App.startRoomRace(p); }
    else if (p.t === 'p') this.onPos(p);
    else if (p.t === 'fin') { this.fins[p.k] = { ft: +p.ft, nick: String(p.nick || '').slice(0, 10) }; App.roomBoard(); }
    else if (p.t === 'e') this.showEmote(p.k, p.e);
    else if (p.t === 'set') { if (from && from.host && WORLDS[p.w] && SUBJECTS[p.s]) { this.world = p.w; this.subject = p.s; App.roomRefresh(); } }
  }
  // ---- emotes ----
  sendEmote(i) {
    if (!Online.emotesOn() || !EMOTES[i]) return; const now = performance.now(); if (now - this.emoT < 1200) return; this.emoT = now;
    this.send({ t: 'e', e: i }); this.showEmote(this.key, i); Sound.play('click');
  }
  showEmote(k, i) {
    if (!Online.emotesOn() || !EMOTES[i | 0]) return; const e = EMOTES[i | 0];
    this.bubbles[k] = { e, until: performance.now() + 2600 };
    const R = App.race;
    if (R && this.st === 'race') {
      const target = k === this.key ? R.player.view.root : (this.ghosts.get(k) || {}).view && this.ghosts.get(k).view.root;
      if (target) { const s = emoteSprite(e); R.scene.add(s); (this._sprites = this._sprites || []).push({ s, target, until: performance.now() + 2600 }); }
    } else App.roomRefresh();
  }
  // ---- live race ----
  beginRace() { this.fins = {}; this.sentFin = false; this._afterFin = 0; this.ghosts.clear(); this._sprites = []; this.setState('race'); }
  onPos(p) {
    const R = App.race; if (!R || this.st !== 'race') return;
    let g = this.ghosts.get(p.k);
    if (!g) { const m = this.members.find((x) => x.key === p.k); if (!m) return; g = this.makeGhost(m); this.ghosts.set(p.k, g); }
    g.buf.push({ t: performance.now() / 1000, x: +p.x, y: +p.y, z: +p.z, h: p.h }); if (g.buf.length > 24) g.buf.shift();
  }
  makeGhost(m) {
    const R = App.race, v = new MallangView(Object.assign({}, m.look || {}, { scale: 0.9 }), true); v.root.scale.setScalar(0.9); R.scene.add(v.root);
    const lab = nameSprite('👫 ' + m.nick, '#d8407f'); R.scene.add(lab);
    return { view: v, lab, buf: [], nick: m.nick, yaw: Math.PI, d: 0 };
  }
  tick(dt) {
    const R = App.race; if (!R || this.st !== 'race') return;
    const P = R.player, now = performance.now();
    this.sendT -= dt;
    if (this.sendT <= 0) { this.sendT = 1 / ROOM_HZ; if (!this.sentFin || this._afterFin-- > 0) this.send({ t: 'p', x: +P.p.x.toFixed(2), y: +P.p.y.toFixed(2), z: +P.p.z.toFixed(2), h: P.respawnT > 0 ? 1 : 0 }); }
    if (P.finished && !this.sentFin) { this.sentFin = true; this._afterFin = 6; const ft = Math.round(P.finishTime * 10) / 10; this.fins[this.key] = { ft, nick: Save.data.profile.nick }; this.send({ t: 'fin', ft, nick: Save.data.profile.nick }); App.roomBoard(); }
    const tr = now / 1000 - 0.25; // draw friends a quarter second in the past so motion stays smooth
    for (const g of this.ghosts.values()) {
      const b = g.buf; if (!b.length) continue;
      let a = b[0], c = b[b.length - 1];
      for (let i = 0; i < b.length - 1; i++) if (b[i].t <= tr && b[i + 1].t >= tr) { a = b[i]; c = b[i + 1]; break; }
      const k = c.t > a.t ? clamp((tr - a.t) / (c.t - a.t), 0, 1) : 1;
      const x = a.x + (c.x - a.x) * k, y = a.y + (c.y - a.y) * k, z = a.z + (c.z - a.z) * k;
      const vx = (c.x - a.x) / Math.max(0.05, c.t - a.t), vz = (c.z - a.z) / Math.max(0.05, c.t - a.t), sp = Math.hypot(vx, vz);
      const hide = (k < 0.5 ? a.h : c.h) || now / 1000 - b[b.length - 1].t > 4;
      g.view.root.visible = !hide; g.lab.visible = !hide;
      if (sp > 0.8) { const ty = Math.atan2(vx, vz); let dy = ty - g.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; g.yaw += dy * Math.min(1, dt * 10); g.view.yaw.rotation.y = g.yaw; }
      g.view.root.position.set(x, y - PHYS.R, z); g.view.update(dt, clamp(sp / PHYS.SPEED, 0, 1), true, sp > 1);
      g.lab.position.set(x, y + 1.35, z); g.d = -z;
    }
    if (this._sprites) this._sprites = this._sprites.filter((o) => { if (now > o.until) { R.scene.remove(o.s); return false; } o.s.position.copy(o.target.position); o.s.position.y += 2.3 + Math.sin(now / 160) * 0.06; return true; });
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.25; this.drawHud(); }
  }
  standings() {
    const R = App.race, rows = [{ key: this.key, nick: Save.data.profile.nick, me: true, d: R ? R.player.d : 0 }];
    for (const m of this.members) if (m.key !== this.key) { const g = this.ghosts.get(m.key); rows.push({ key: m.key, nick: m.nick, d: g ? g.d : 0 }); }
    rows.forEach((r) => { const f = this.fins[r.key]; r.ft = f ? f.ft : null; });
    return rows.sort((a, b) => (a.ft != null && b.ft != null ? a.ft - b.ft : a.ft != null ? -1 : b.ft != null ? 1 : b.d - a.d));
  }
  drawHud() {
    const el = $('#roomhud'); if (!el) return; const F = App.race ? App.race.course.FINISH : 600;
    el.innerHTML = `<b>👫 친구 방</b>` + this.standings().map((r, i) => `<div class="${r.me ? 'me' : ''}"><span>${i + 1}</span>${escapeHtml(r.nick)}<em>${r.ft != null ? '🏁 ' + fmtTime(r.ft) : Math.round(clamp(r.d / F, 0, 1) * 100) + '%'}</em></div>`).join('');
  }
  async leave() {
    clearTimeout(this._nhT);
    try { if (this.ch) { await this.ch.untrack(); Online.sb.removeChannel(this.ch); } } catch (e) {}
    this.ch = null;
    if (this.isHost && Online.child) { try { await Online.rpc('close_room', { child: Online.child.id }); } catch (e) {} }
  }
}
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

Object.assign(App, {
  // friend rooms menu (needs an online child)
  async menuRooms() {
    if (this.room) return this.drawRoomLobby();
    if (!Online.child) {
      this.modal(`<h2>👫 친구 방</h2><p>친구 방은 <b>보호자 계정</b>으로 로그인한 아이만 쓸 수 있어요. 보호자님이 승인한 친구끼리만 함께 달려요.</p><div class="row" style="justify-content:center">${Online.enabled ? '<button class="btn" id="rm-login">👨‍👩‍👧 보호자 계정으로 하기</button>' : '<p class="muted">이 버전은 아직 서버가 연결되지 않았어요.</p>'}<button class="btn sm gray" onclick="App.closeModal()">닫기</button></div>`);
      if ($('#rm-login')) $('#rm-login').onclick = () => this.olEntry(); return;
    }
    if (!Online.roomsOn()) { this.modal('<h2>👫 친구 방</h2><p>보호자님이 친구 방을 꺼 두었어요.</p><button class="btn" onclick="App.closeModal()">알겠어요</button>'); return; }
    this.modal(`<h2>👫 친구 방</h2><p class="muted">보호자님이 승인한 친구끼리만 들어올 수 있어요. 방에는 8명까지 들어오고, 남은 자리는 AI 말랑이가 채워요. 대화는 이모티콘으로만 해요.</p>
      <div class="row" style="justify-content:center;margin:8px 0"><button class="btn" id="rm-new">🏠 방 만들기</button></div>
      <div class="row"><input class="ol-inline" id="rm-code" maxlength="4" placeholder="방 코드 4자리" style="text-transform:uppercase;flex:1"><button class="btn sm blue" id="rm-join">코드로 들어가기</button></div>
      <div class="ol-msg" id="ol-msg"></div><h3>열려 있는 친구 방</h3><div id="rm-list"><p class="muted">찾는 중…</p></div>`);
    $('#rm-new').onclick = () => this.openRoom(null);
    $('#rm-join').onclick = () => this.openRoom($('#rm-code').value.trim().toUpperCase());
    try {
      const rooms = await Online.rpc('friend_rooms', { child: Online.child.id }); const el = $('#rm-list'); if (!el) return;
      el.innerHTML = rooms.length ? rooms.map((r) => `<div class="wn ol-row"><span>${blobHtml(r.look && r.look.c, 26)} <b>${escapeHtml(r.host)}</b>의 방</span><button class="btn sm green" data-rc="${r.code}">들어가기</button></div>`).join('') : '<p class="muted">지금 열린 친구 방이 없어요. 방을 만들고 친구에게 코드를 알려 주세요.</p>';
      $$('[data-rc]').forEach((b) => (b.onclick = () => this.openRoom(b.dataset.rc)));
    } catch (e) { const el = $('#rm-list'); if (el) el.innerHTML = `<p class="ol-msg bad">${olErr(e)}</p>`; }
  },
  async openRoom(code) {
    if (Online.timeLeft() <= 0) return this.olTimeUpModal();
    const say = (t) => { const m = $('#ol-msg'); if (m) m.textContent = t; else this.modal(`<h2>👫 친구 방</h2><p class="ol-msg bad">${escapeHtml(t)}</p><button class="btn" onclick="App.menuRooms()">친구 방 메뉴</button>`); };
    let host = '', isHost = !code;
    try {
      if (isHost) { const r = await Online.call('create_room', { child: Online.child.id }); code = r.code; host = Save.data.profile.nick; }
      else { if (!/^[A-Z0-9]{4}$/.test(code)) return say('방 코드 4자리를 써 주세요.'); const r = await Online.call('join_room', { child: Online.child.id, code }); host = r.host; }
    } catch (e) { return say(olErr(e)); }
    this.room = new Room(code, isHost, host);
    const ws = Save.data.unlockedWorlds.filter((w) => WORLDS[w]); this.room.world = ws[ws.length - 1] || 'candy';
    this.modal('<h2>👫 친구 방</h2><p>들어가는 중…</p>');
    try { await this.room.connect(); }
    catch (e) { console.warn(e); await this.leaveRoom(true); this.modal(`<h2>👫 친구 방</h2><p class="ol-msg bad">방에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.</p><button class="btn" onclick="App.menuRooms()">돌아가기</button>`); return; }
    this.drawRoomLobby();
  },
  async leaveRoom(silent) {
    const r = this.room; if (!r) return; this.room = null;
    $('#roomhud').classList.add('hidden'); $('#emotebar').classList.add('hidden');
    await r.leave();
    if (!silent) this.closeModal();
  },
  emoteRow(cls = '') { return Online.emotesOn() ? `<div class="emotes ${cls}">${EMOTES.map((e, i) => `<button data-emo="${i}">${e}</button>`).join('')}</div>` : '<p class="muted">이모티콘은 보호자님이 꺼 두었어요.</p>'; },
  bindEmotes(root = document) { $$('[data-emo]', root).forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); if (this.room) this.room.sendEmote(+b.dataset.emo); })); },
  drawRoomLobby() {
    const R = this.room; if (!R) return; const now = performance.now();
    const ms = R.members.length ? R.members : [{ key: R.key, nick: Save.data.profile.nick, look: playerLookSafe(), host: R.isHost, st: R.st }];
    const allBack = ms.every((m) => m.st !== 'race'), canGo = R.isHost && ms.length >= 2 && allBack;
    const ws = R.isHost ? Save.data.unlockedWorlds.filter((w) => WORLDS[w]) : [R.world];
    this.modal(`<div id="room-lobby"><h2>👫 친구 방 <span class="room-code">${R.code}</span></h2>
      <p class="muted">${R.isHost ? '친구에게 방 코드를 알려 주세요. 친구 화면에도 초대가 떠요.' : `<b>${escapeHtml(R.hostNick)}</b>의 방이에요. 방장이 출발을 누르면 시작해요.`}</p>
      <div class="room-mem">${ms.map((m) => { const b = R.bubbles[m.key]; return `<div class="${m.key === R.key ? 'me' : ''}">${b && b.until > now ? `<i class="bub">${b.e}</i>` : ''}${blobHtml(m.look ? hexCss(m.look.colorHex || 0xff7eb6) : '#ff7eb6', 48)}<b>${escapeHtml(m.nick)}</b><small>${m.host ? '👑 방장' : ''}${m.st === 'race' ? ' 🏃 달리는 중' : ''}</small></div>`; }).join('')}</div>
      <div class="room-set"><div><small>월드</small><div class="row">${ws.map((w) => `<button class="chip sm ${w === R.world ? 'on' : ''}" ${R.isHost ? `data-rw="${w}"` : ''}>${WORLDS[w].icon} ${WORLDS[w].name}</button>`).join('')}</div></div>
      <div><small>문제</small><div class="row">${['math', 'english', 'quiz'].map((s) => `<button class="chip sm ${s === R.subject ? 'on' : ''}" ${R.isHost ? `data-rs="${s}"` : ''}>${SUBJECTS[s].icon} ${SUBJECTS[s].name}</button>`).join('')}</div></div></div>
      <p class="muted">산수 문제는 각자 자기 학년 수준으로 나와요. 코스는 모두 같아요.</p>
      ${this.emoteRow()}
      <div class="row" style="justify-content:center;margin-top:10px">${R.isHost ? `<button class="btn" id="rm-go" ${canGo ? '' : 'disabled'}>${ms.length < 2 ? '친구를 기다리는 중…' : allBack ? `🏁 출발! (${ms.length}명)` : '친구가 돌아오길 기다려요…'}</button>` : ''}<button class="btn sm gray" id="rm-out">방 나가기</button></div></div>`);
    this.bindEmotes($('#room-lobby'));
    $$('[data-rw]').forEach((b) => (b.onclick = () => { R.world = b.dataset.rw; R.send({ t: 'set', w: R.world, s: R.subject }); this.drawRoomLobby(); }));
    $$('[data-rs]').forEach((b) => (b.onclick = () => { R.subject = b.dataset.rs; R.send({ t: 'set', w: R.world, s: R.subject }); this.drawRoomLobby(); }));
    if ($('#rm-go')) $('#rm-go').onclick = () => { if (!canGo) return; const p = { t: 'start', w: R.world, s: R.subject, seed: randi(1, 2e9), cl: Save.data.profile.level }; R.send(p); this.startRoomRace(p); };
    $('#rm-out').onclick = () => this.leaveRoom();
    clearTimeout(this._lobbyT); if (Object.values(R.bubbles).some((b) => b.until > now)) this._lobbyT = setTimeout(() => this.roomRefresh(), 2700);
  },
  roomRefresh() { if (!this.room) return; if ($('#room-lobby')) this.drawRoomLobby(); else if ($('#room-board')) this.roomBoard(); },
  startRoomRace(p) {
    const R = this.room; if (!R || !WORLDS[p.w]) return;
    if (this.race && this.race.state !== 'done') return; // still racing the previous one
    if (Online.timeLeft() <= 0) { this.olTimeUpModal(); return; }
    R.world = p.w; R.subject = SUBJECTS[p.s] && p.s !== 'run' ? p.s : 'math'; R.beginRace();
    if (this.race) { this.race.dispose(); this.race = null; }
    const others = Math.max(0, R.members.length - 1);
    this.startRace(p.w, Math.max(10, 50 - others), R.subject, true, { seed: p.seed | 0, courseLevel: clamp(p.cl | 0, 1, 6) || Save.data.profile.level, room: R.code });
    $('#hud-sim').textContent = `👫 친구 방 ${R.code} · 친구 ${others}명`;
    $('#roomhud').classList.remove('hidden');
    const eb = $('#emotebar'); if (Online.emotesOn()) { eb.innerHTML = `<button class="eb-t">😀</button>${this.emoteRow('eb-row')}`; eb.classList.remove('hidden'); eb.classList.remove('open'); $('.eb-t', eb).onclick = (e) => { e.stopPropagation(); eb.classList.toggle('open'); }; this.bindEmotes(eb); } else eb.classList.add('hidden');
  },
  roomBoard() {
    const el = $('#room-board'), R = this.room; if (!el || !R) return;
    el.innerHTML = '<b>👫 친구 방 순위</b>' + R.standings().map((r, i) => `<div class="${r.me ? 'me' : ''}"><span>${r.ft != null ? i + 1 + '등' : '…'}</span>${escapeHtml(r.nick)}${r.me ? ' (나)' : ''}<em>${r.ft != null ? fmtTime(r.ft) : '달리는 중'}</em></div>`).join('');
  },
  roomBackToLobby() {
    this.paused = false; if (this.race) this.race.dispose(); this.race = null;
    $('#roomhud').classList.add('hidden'); $('#emotebar').classList.add('hidden');
    this.enterHub(); if (!this.room) return; this.room.setState('lobby'); this.drawRoomLobby();
  },
  // a friend opened a room: show an invite banner in the plaza
  async pollRooms() {
    const el = $('#roomcall'); if (!el) return;
    const ok = Online.child && Online.roomsOn() && !this.room && !this.race && this.screen === 'hub';
    if (!ok) { el.classList.add('hidden'); return; }
    try {
      const rooms = await Online.rpc('friend_rooms', { child: Online.child.id }); this._dismissed = this._dismissed || {};
      const r = rooms.find((x) => !this._dismissed[x.code]);
      if (!r || this.room || this.screen !== 'hub') { el.classList.add('hidden'); return; }
      el.innerHTML = `${blobHtml(r.look && r.look.c, 30)}<span><b>${escapeHtml(r.host)}</b>의 친구 방이 열렸어요!</span><button class="btn sm green" id="rc-go">들어가기</button><button class="rc-x" id="rc-x">✕</button>`;
      el.classList.remove('hidden');
      $('#rc-go').onclick = () => { el.classList.add('hidden'); this.openRoom(r.code); };
      $('#rc-x').onclick = () => { this._dismissed[r.code] = 1; el.classList.add('hidden'); };
    } catch (e) { el.classList.add('hidden'); }
  },
});
