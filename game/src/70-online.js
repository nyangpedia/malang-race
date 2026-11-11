// ================================================================
// Online: guardian accounts, child profiles, cloud save, rankings, friends, play-time limits.
// Everything here is optional; with no server settings the game stays offline.
// ================================================================
const OL_ERR = {
  pin: 'PIN이 맞지 않아요.', pin_locked: 'PIN을 5번 틀려서 5분 동안 잠겼어요.', pin_format: 'PIN은 숫자 4자리예요.',
  nick: '닉네임은 한글·영문·숫자 2~10글자로 써 주세요. 긴 숫자나 나쁜 말은 쓸 수 없어요.',
  max_children: '아이는 4명까지 등록할 수 있어요.', no_code: '그런 친구 코드가 없어요.', self: '내 친구 코드예요.',
  exists: '이미 친구이거나 신청한 친구예요.', too_many: '승인을 기다리는 신청이 너무 많아요.',
  not_friend: '보호자님이 승인한 친구의 방만 들어갈 수 있어요.', no_room: '방이 없거나 이미 닫혔어요.',
  rooms_off: '보호자님이 친구 방을 꺼 두었어요.', not_mine: '권한이 없어요.', auth: '로그인이 필요해요.',
  invalid: '기록을 확인하지 못했어요.', not_admin: '관리자만 할 수 있어요.', too_long: '공지는 200글자까지 쓸 수 있어요.', too_fast: '', net: '서버에 연결하지 못했어요. 인터넷을 확인해 주세요.',
};
const olErr = (e) => (e && e.err ? OL_ERR[e.err] || e.err : e && e.message ? (/fetch|network|Failed/i.test(e.message) ? OL_ERR.net : e.message) : OL_ERR.net);
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

const Online = {
  enabled: false, sb: null, session: null, guardian: null, children: [], child: null,
  pin: null, pinT: 0, syncState: '', ready: false,
  async init() {
    const lib = window.__SB_MOCK || window.supabase;
    this.enabled = !!(ONLINE_CFG.url && ONLINE_CFG.key && !ONLINE_CFG.url.includes('/*') && lib && lib.createClient);
    if (!this.enabled) return;
    try {
      this.sb = lib.createClient(ONLINE_CFG.url, ONLINE_CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'malangrace.auth' } });
      this.sb.auth.onAuthStateChange((ev, s) => {
        this.session = s;
        if (ev === 'PASSWORD_RECOVERY') setTimeout(() => App.olNewPassword(), 400);
        if (ev === 'SIGNED_IN' && this.ready && !this.guardian) this.loadFamily().then(() => App.olAfterLogin());
      });
      const { data } = await this.sb.auth.getSession(); this.session = data.session;
      if (this.session) await this.loadFamily();
    } catch (e) { console.warn('online init', e); }
    this.ready = true;
  },
  get email() { return this.session && this.session.user ? this.session.user.email : ''; },
  async rpc(fn, args) { const { data, error } = await this.sb.rpc(fn, args || {}); if (error) throw error; return data; },
  // rpc that returns {ok, err}; throws {err} on refusal
  async call(fn, args) { const r = await this.rpc(fn, args); if (r && r.ok === false) throw r; return r; },
  async loadFamily() {
    const g = await this.sb.from('guardians').select('id,consent_at').maybeSingle(); if (g.error) throw g.error; this.guardian = g.data || null;
    const c = await this.sb.from('children').select('id,nickname,friend_code,look,level,controls,created_at').order('created_at'); if (c.error) throw c.error;
    this.children = c.data || [];
    try { this.admin = !!(await this.rpc('is_admin')); } catch (e) { this.admin = false; }
    if (this.child) this.child = this.children.find((k) => k.id === this.child.id) || null;
  },
  lastChildId() { return LS.get('malangrace.child'); },
  // switch the game's save to this child: newest of this device's copy and the server copy wins
  async activate(child) {
    this.child = child; LS.set('malangrace.child', child.id);
    const key = 'malangrace.save.c.' + child.id, local = Save.read(key);
    let cloud = null;
    try { const r = await this.sb.from('saves').select('data,updated_at').eq('child_id', child.id).maybeSingle(); cloud = r.data ? r.data.data : null; } catch (e) { console.warn(e); }
    let d = local; if (cloud && (!local || (cloud._ts || 0) > (local._ts || 0))) d = cloud;
    Save.key = key; Save.use(d);
    if (Save.data.profile) { Save.data.profile.nick = child.nickname; Save.data.profile.level = Save.data.profile.level || child.level; }
    this._pushed = ''; Save.save(true);
  },
  goOffline() { this.child = null; LS.del('malangrace.child'); Save.key = SAVE_KEY; Save.load(); },
  async signOut() { try { await this.sb.auth.signOut(); } catch (e) {} this.session = null; this.guardian = null; this.children = []; this.pin = null; this.goOffline(); },
  // ---- cloud save ----
  onSave(quiet) { if (!this.child || !this.sb) return; clearTimeout(this._syncT); this._syncT = setTimeout(() => this.sync(), quiet ? 500 : 2500); },
  async sync() {
    if (!this.child) return; const id = this.child.id;
    try {
      const { error } = await this.sb.from('saves').upsert({ child_id: id, data: Save.data, updated_at: new Date().toISOString() });
      if (error) throw error; this.syncState = 'ok'; this.pushProfile();
    } catch (e) { this.syncState = 'err'; clearTimeout(this._syncT); this._syncT = setTimeout(() => this.sync(), 20000); }
    App.drawCloud && App.drawCloud();
  },
  lookMini() { const S = Save.data, c = COLORS[S.equip.color]; return { c: c ? hexCss(c.hex) : '#ff7eb6', costume: S.equip.costume, hat: S.equip.hat }; },
  async pushProfile() {
    const S = Save.data; if (!this.child || !S.profile) return;
    const look = this.lookMini(), key = JSON.stringify([look, S.profile.level]); if (key === this._pushed) return; this._pushed = key;
    try { await this.call('update_child_profile', { child: this.child.id, look, lvl: S.profile.level }); this.child.look = look; this.child.level = S.profile.level; } catch (e) { this._pushed = ''; }
  },
  // ---- play time (kept for every player; enforced when a guardian set a limit) ----
  tickPlay(dt) {
    const S = Save.data; if (!S.profile) return; const day = todayStr(); S.playLog = S.playLog || {};
    S.playLog[day] = (S.playLog[day] || 0) + dt; this._pt = (this._pt || 0) + dt;
    if (this._pt > 30) { this._pt = 0; const keys = Object.keys(S.playLog).sort(); while (keys.length > 21) delete S.playLog[keys.shift()]; Save.save(); }
  },
  limitMin() { return this.child && this.child.controls ? +this.child.controls.daily_min || 0 : 0; },
  timeLeft() { const m = this.limitMin(); if (!m) return Infinity; return m * 60 - ((Save.data.playLog || {})[todayStr()] || 0); },
  emotesOn() { return !this.child || !this.child.controls || this.child.controls.emotes !== false; },
  roomsOn() { return !!this.child && (!this.child.controls || this.child.controls.rooms !== false); },
  // ---- scores ----
  async submitScore(res, inRoom) {
    if (!this.child) return null;
    try {
      const r = await this.call('submit_score', { child: this.child.id, world: res.worldId, subject: res.subject || 'math', rnk: res.rank, n: res.N, time_s: Math.round(res.time * 10) / 10, correct: Math.min(res.correct, 5), attempts: Math.min(res.attempts, 5), in_room: !!inRoom });
      return r.score;
    } catch (e) { return null; }
  },
  pinValid() { return this.pin && Date.now() - this.pinT < 5 * 60 * 1000; },
};

// ---------------- screens ----------------
const blobHtml = (c, s = 34) => `<span class="blob" style="--c:${escapeHtml(c || '#ff7eb6')};width:${s}px;height:${Math.round(s * 0.92)}px"></span>`;
const minFmt = (sec) => { const m = Math.round((sec || 0) / 60); return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분`; };

Object.assign(App, {
  // title buttons once the server answer is known
  drawTitleOnline() {
    const b = $('#btn-online'), st = $('#title-online'); if (!b) return;
    if (!Online.enabled) { b.classList.add('hidden'); st.textContent = ''; return; }
    b.classList.remove('hidden'); $('#btn-start').classList.toggle('hidden', !Online.child);
    if (Online.child) { b.textContent = '👨‍👩‍👧 다른 아이 · 보호자'; st.textContent = `☁️ ${Online.child.nickname}(으)로 이어서 해요`; $('#btn-start').textContent = `▶ ${Online.child.nickname} 시작`; }
    else if (Online.session) { b.textContent = '👨‍👩‍👧 누가 할까요?'; st.textContent = `☁️ 보호자 로그인됨 · ${Online.email}`; $('#btn-start').textContent = '이 기기에서만 하기'; }
    else { b.textContent = '✨ 회원가입 · 🔑 로그인'; st.textContent = '보호자 계정이 있으면 기록이 서버에 저장되고 친구와 함께 달릴 수 있어요'; }
  },
  async olBoot() {
    await Online.init();
    if (Online.enabled && Online.session && Online.guardian) {
      const id = Online.lastChildId(), c = Online.children.find((k) => k.id === id);
      if (c) await Online.activate(c);
    }
    this.refreshPlayerLook(); this.drawTitleOnline();
    if (Online.session && !Online.guardian && this.screen === 'title') this.olRegisterGuardian();
    else if (Online.enabled && !Online.session && this.screen === 'title' && $('#modal').classList.contains('hidden')) this.olChoose();
  },
  olStart() { // title "start"
    if (Online.child) { if (Save.data.profile) this.enterHub(); else this.showRegister(); return; }
    if (Online.enabled) return this.olEntry(); // accounts only: sign up or log in, then pick a child
    if (Save.data.profile) this.enterHub(); else this.showRegister();
  },
  olChoose() {
    this.modal(`<h2>👋 말랑 레이스에 오신 걸 환영해요!</h2>
      <p class="muted">보호자가 계정을 만들면 아이 기록이 서버에 저장되고, 랭킹에 오르고, 승인한 친구와 함께 달릴 수 있어요.</p>
      <div class="ol-choose">
        <button class="btn green" data-m="signup">✨ 회원가입 <small>처음이에요 (보호자가 해요)</small></button>
        <button class="btn blue" data-m="login">🔑 로그인 <small>계정이 있어요</small></button>
      </div>`);
    $$('.ol-choose [data-m]').forEach((b) => (b.onclick = () => this.olAuth(b.dataset.m)));
  },
  olEntry() { if (!Online.session) return this.olChoose(); if (!Online.guardian) return this.olRegisterGuardian(); this.olPickChild(); },
  // ---- guardian sign in / sign up ----
  olAuth(mode = 'login', msg = '') {
    const su = mode === 'signup';
    this.modal(`<h2>👨‍👩‍👧 보호자 계정</h2>
      <div class="tabs"><button class="tab ${su ? '' : 'on'}" data-m="login">로그인</button><button class="tab ${su ? 'on' : ''}" data-m="signup">처음 가입하기</button></div>
      <p class="muted">아이 대신 <b>보호자</b>가 가입하고 로그인해요. 아이는 닉네임만 쓰고, 실명·생일·전화번호는 받지 않아요.</p>
      <div class="field"><label>보호자 이메일</label><input id="ol-email" type="email" autocomplete="email" value="${escapeHtml(Online.email || '')}"></div>
      <div class="field"><label>비밀번호 ${su ? '(8글자 이상)' : ''}</label><input id="ol-pw" type="password" autocomplete="${su ? 'new-password' : 'current-password'}"></div>
      <div class="ol-msg" id="ol-msg">${msg}</div>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="ol-go">${su ? '가입하기' : '로그인'}</button>${su ? '' : '<button class="btn sm gray" id="ol-forgot">비밀번호를 잊었어요</button>'}</div>`);
    $$('[data-m]').forEach((b) => (b.onclick = () => this.olAuth(b.dataset.m)));
    const say = (t, bad) => { const m = $('#ol-msg'); m.textContent = t; m.classList.toggle('bad', !!bad); };
    $('#ol-go').onclick = async () => {
      const email = $('#ol-email').value.trim(), password = $('#ol-pw').value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return say('이메일을 확인해 주세요.', true);
      if (password.length < (su ? 8 : 1)) return say('비밀번호는 8글자 이상이에요.', true);
      $('#ol-go').disabled = true; say(su ? '가입하는 중…' : '로그인하는 중…');
      try {
        const redirect = location.href.split('#')[0].split('?')[0];
        const r = su ? await Online.sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } }) : await Online.sb.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        if (su && !r.data.session) { this.olAuth('login', `📮 ${escapeHtml(email)}(으)로 확인 메일을 보냈어요. 메일의 확인 버튼을 누르면 이 화면으로 돌아와 이어서 할 수 있어요.`); return; }
        Online.session = r.data.session; await Online.loadFamily(); this.olAfterLogin();
      } catch (e) {
        const m = e.message || ''; say(/Invalid login/i.test(m) ? '이메일이나 비밀번호가 맞지 않아요.' : /not confirmed/i.test(m) ? '메일함에서 확인 버튼을 먼저 눌러 주세요.' : /already registered/i.test(m) ? '이미 가입된 이메일이에요. 로그인해 주세요.' : /rate limit/i.test(m) ? '메일 보내기가 잠시 막혔어요. 조금 뒤 다시 해 주세요.' : olErr(e), true);
        $('#ol-go').disabled = false;
      }
    };
    if (!su) $('#ol-forgot').onclick = async () => {
      const email = $('#ol-email').value.trim(); if (!/^\S+@\S+\.\S+$/.test(email)) return say('이메일을 먼저 써 주세요.', true);
      const { error } = await Online.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0].split('?')[0] });
      say(error ? olErr(error) : '비밀번호를 바꾸는 메일을 보냈어요.', !!error);
    };
  },
  olNewPassword() {
    this.modal(`<h2>🔑 새 비밀번호</h2><div class="field"><label>새 비밀번호 (8글자 이상)</label><input id="ol-np" type="password" autocomplete="new-password"></div><div class="ol-msg" id="ol-msg"></div><div class="row" style="justify-content:center"><button class="btn" id="ol-go">바꾸기</button></div>`);
    $('#ol-go').onclick = async () => { const p = $('#ol-np').value; if (p.length < 8) { $('#ol-msg').textContent = '8글자 이상으로 써 주세요.'; return; } const { error } = await Online.sb.auth.updateUser({ password: p }); if (error) { $('#ol-msg').textContent = olErr(error); return; } await Online.loadFamily(); this.olAfterLogin(); };
  },
  olAfterLogin() { this.drawTitleOnline(); if (!Online.guardian) this.olRegisterGuardian(); else this.olPickChild(); },
  // ---- guardian consent + PIN (first login) ----
  olRegisterGuardian() {
    this.modal(`<h2>📝 보호자 확인과 동의</h2>
      <div class="ol-consent">
        <b>모으는 정보</b> 보호자 이메일, 아이 닉네임, 말랑이 모습, 게임 기록(점수·순위·학습 기록·오답노트·플레이 시간)<br>
        <b>쓰는 곳</b> 기록 저장, 랭킹, 보호자 확인 화면, 보호자가 승인한 친구와 함께 달리기<br>
        <b>다른 사람에게 보이는 것</b> 닉네임, 말랑이 색, 학년 레벨, 랭킹 점수만 보여요<br>
        <b>보관</b> 보호자 메뉴에서 계정을 지우면 모든 기록이 바로 지워져요<br>
        <b>받지 않는 것</b> 아이 실명, 생년월일, 전화번호, 사진, 위치, 자유 채팅
      </div>
      <label class="ol-check"><input type="checkbox" id="c1"> 저는 이 계정으로 게임할 아이의 보호자(법정대리인)예요.</label>
      <label class="ol-check"><input type="checkbox" id="c2"> 위 정보를 모으고 쓰는 것에 동의해요.</label>
      <div class="field"><label>보호자 PIN 숫자 4자리 <span class="muted">(아이가 보호자 메뉴를 열지 못하게 해요)</span></label><input id="p1" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></div>
      <div class="field"><label>PIN 한 번 더</label><input id="p2" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></div>
      <div class="ol-msg" id="ol-msg"></div>
      <div class="row" style="justify-content:center"><button class="btn" id="ol-go">동의하고 시작</button><button class="btn sm gray" id="ol-out">로그아웃</button></div>`);
    $('#ol-out').onclick = async () => { await Online.signOut(); this.closeModal(); this.drawTitleOnline(); };
    $('#ol-go').onclick = async () => {
      const m = $('#ol-msg'), p = $('#p1').value;
      if (!$('#c1').checked || !$('#c2').checked) { m.textContent = '두 가지 모두 체크해 주세요.'; return; }
      if (!/^\d{4}$/.test(p)) { m.textContent = 'PIN은 숫자 4자리예요.'; return; }
      if (p !== $('#p2').value) { m.textContent = '두 PIN이 달라요.'; return; }
      try { await Online.call('register_guardian', { pin: p }); Online.pin = p; Online.pinT = Date.now(); await Online.loadFamily(); this.olAddChild(true); } catch (e) { m.textContent = olErr(e); }
    };
  },
  // ---- PIN gate ----
  olPin(next, title = '보호자 PIN') {
    if (Online.pinValid()) { Online.pinT = Date.now(); return next(); }
    this.modal(`<h2>🔒 ${title}</h2><p class="muted">보호자만 열 수 있어요.</p><div class="field"><input id="ol-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" style="text-align:center;letter-spacing:12px;font-size:32px"></div><div class="ol-msg" id="ol-msg"></div><div class="row" style="justify-content:center"><button class="btn" id="ol-go">확인</button><button class="btn sm gray" id="ol-x">닫기</button></div>`);
    $('#ol-pin').focus(); $('#ol-x').onclick = () => this.closeModal();
    const go = async () => { const p = $('#ol-pin').value; try { await Online.call('verify_pin', { pin: p }); Online.pin = p; Online.pinT = Date.now(); next(); } catch (e) { $('#ol-msg').textContent = olErr(e); $('#ol-pin').value = ''; } };
    $('#ol-go').onclick = go; $('#ol-pin').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  },
  // ---- who plays? ----
  olPickChild() {
    const K = Online.children;
    this.modal(`<h2>🎮 누가 할까요?</h2>
      <div class="ol-kids">${K.map((k) => `<button class="ol-kid" data-k="${k.id}">${blobHtml(k.look && k.look.c, 56)}<b>${escapeHtml(k.nickname)}</b><small>LV${k.level}</small></button>`).join('')}
      ${K.length < 4 ? '<button class="ol-kid add" id="ol-add"><span class="plus">＋</span><b>아이 추가</b><small>보호자 PIN</small></button>' : ''}</div>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn sm blue" id="ol-parent">👨‍👩‍👧 보호자 메뉴</button><button class="btn sm gray" id="ol-local">이 기기에서만 하기</button><button class="btn sm gray" id="ol-out">로그아웃</button></div>
      <p class="muted" style="text-align:center">${escapeHtml(Online.email)}</p>`);
    $$('[data-k]').forEach((b) => (b.onclick = async () => {
      if (this.room) this.leaveRoom(true);
      const c = K.find((k) => k.id === b.dataset.k); b.disabled = true; await Online.activate(c); this.refreshPlayerLook(); this.closeModal(); this.drawTitleOnline();
      if (Save.data.profile) this.enterHub(); else this.showRegister();
    }));
    if ($('#ol-add')) $('#ol-add').onclick = () => this.olPin(() => this.olAddChild());
    $('#ol-parent').onclick = () => this.olPin(() => this.olParent());
    $('#ol-local').onclick = () => { if (this.room) this.leaveRoom(true); Online.goOffline(); this.refreshPlayerLook(); this.closeModal(); this.drawTitleOnline(); if (Save.data.profile) this.enterHub(); else this.showRegister(); };
    $('#ol-out').onclick = async () => { if (this.room) this.leaveRoom(true); await Online.signOut(); this.refreshPlayerLook(); this.closeModal(); this.show('title'); this.drawTitleOnline(); };
  },
  olAddChild(first) {
    const off = Save.read(SAVE_KEY), canMove = off && off.profile && !LS.get('malangrace.moved');
    let lvl = off && off.profile ? off.profile.level : 2;
    this.modal(`<h2>${first ? '👋 우리 아이 등록' : '＋ 아이 추가'}</h2>
      <div class="field"><label>닉네임 (2~10글자, 실명 말고 별명)</label><input id="ol-nick" maxlength="10" autocomplete="off" value="${canMove ? escapeHtml(off.profile.nick) : ''}"></div>
      <div class="field"><label>수학 레벨 <span class="muted">(나중에 게임에서 바꿀 수 있어요)</span></label><div class="row" id="ol-lv"></div></div>
      ${canMove ? `<label class="ol-check"><input type="checkbox" id="ol-move" checked> 이 기기에 있던 <b>${escapeHtml(off.profile.nick)}</b>의 기록(레벨, 에너지, 코스튬, 오답노트)을 이 아이에게 옮겨요.</label>` : ''}
      <div class="ol-msg" id="ol-msg"></div>
      <div class="row" style="justify-content:center"><button class="btn" id="ol-go">등록하기</button>${first ? '' : '<button class="btn sm gray" id="ol-x">취소</button>'}</div>`);
    const drawLv = () => { $('#ol-lv').innerHTML = [1, 2, 3, 4, 5, 6].map((l) => `<button class="chip ${l === lvl ? 'on' : ''}" data-l="${l}">${LEVELS[l].icon} LV${l}</button>`).join(''); $$('#ol-lv [data-l]').forEach((b) => (b.onclick = () => { lvl = +b.dataset.l; drawLv(); })); };
    drawLv(); if ($('#ol-x')) $('#ol-x').onclick = () => this.olPickChild();
    $('#ol-go').onclick = () => this.olPin(async () => {
      const nick = ($('#ol-nick') ? $('#ol-nick').value : '').trim(), move = $('#ol-move') && $('#ol-move').checked;
      try {
        const r = await Online.call('create_child', { nick, look: { c: '#ff7eb6' }, lvl, pin: Online.pin });
        if (move) { const d = Save.read(SAVE_KEY); d.profile.nick = r.child.nickname; d._ts = Date.now(); LS.set('malangrace.save.c.' + r.child.id, JSON.stringify(d)); LS.set('malangrace.moved', '1'); }
        await Online.loadFamily(); this.olPickChild();
      } catch (e) { this.olAddChild(first); $('#ol-msg').textContent = olErr(e); if ($('#ol-nick')) $('#ol-nick').value = nick; }
    });
  },
  // ---------------- guardian menu ----------------
  // ---------- operator (admin) screen: only accounts listed in public.admins ----------
  async olAdmin(q = '') {
    const back = '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm gray" id="ad-back">← 보호자 메뉴</button></div>';
    this.modal('<h2>🛠️ 관리자 모드</h2><p class="muted">불러오는 중…</p>');
    let st, kids, notice;
    try { [st, kids, notice] = await Promise.all([Online.call('admin_stats'), Online.rpc('admin_find_children', { q }), Online.rpc('get_notice')]); }
    catch (e) { this.modal(`<h2>🛠️ 관리자 모드</h2><p class="ol-msg bad">${olErr(e)}</p>${back}`); $('#ad-back').onclick = () => this.olParent('kids'); return; }
    const box = (n, l) => `<div class="ad-stat"><b>${(+n || 0).toLocaleString('ko-KR')}</b><span>${l}</span></div>`;
    const days = st.daily || [], mx = Math.max(1, ...days.map((d) => d.n));
    const nt = notice && notice[0];
    this.modal(`<h2>🛠️ 관리자 모드</h2>
      <div class="ad-grid">${box(st.guardians, '보호자 계정')}${box(st.children, '아이')}${box(st.new_children_7d, '7일 새 아이')}${box(st.players_today, '오늘 플레이한 아이')}${box(st.games_today, '오늘 판 수')}${box(st.games_7d, '7일 판 수')}${box(st.room_games_7d, '7일 친구 방 판')}${box(st.friendships, '친구 맺기')}</div>
      <h3>최근 14일 판 수</h3><div class="ad-bars">${days.length ? days.map((d) => `<div title="${d.d} · ${d.n}판"><i style="height:${Math.round(d.n / mx * 100)}%"></i><small>${d.d.slice(3)}</small></div>`).join('') : '<p class="muted">아직 기록이 없어요.</p>'}</div>
      <h3>📢 공지</h3><p class="muted">모든 아이가 광장에 들어올 때 한 번 보여요. 비워서 저장하면 공지를 내려요.</p>
      <div class="row"><input class="ol-inline" id="ad-notice" maxlength="200" style="flex:1" value="${escapeHtml(nt ? nt.body : '')}" placeholder="예: 이번 주말에 새 월드가 열려요!"><button class="btn sm blue" id="ad-nsave">저장</button></div>
      <h3>👧 아이 찾기</h3><div class="row"><input class="ol-inline" id="ad-q" style="flex:1" value="${escapeHtml(q)}" placeholder="닉네임 또는 친구 코드"><button class="btn sm blue" id="ad-find">찾기</button></div>
      <div class="ad-list">${(kids || []).map((k) => `<div class="wn ol-row" data-ak="${k.id}"><span><b>${escapeHtml(k.nickname)}</b> <span class="muted">LV${k.level} · ${k.friend_code} · ${new Date(k.created_at).toLocaleDateString('ko-KR')}</span></span><span class="muted">${k.games}판 · 최고 ${k.best || 0}점 ›</span></div>`).join('') || '<p class="muted">찾은 아이가 없어요.</p>'}</div>
      <div class="ol-msg" id="ol-msg"></div>${back}`);
    const msg = (t) => { $('#ol-msg').textContent = t; };
    $('#ad-back').onclick = () => this.olParent('kids');
    $('#ad-find').onclick = () => this.olAdmin($('#ad-q').value.trim());
    $('#ad-q').onkeydown = (e) => { if (e.key === 'Enter') $('#ad-find').click(); };
    $('#ad-nsave').onclick = async () => { try { const r = await Online.call('admin_set_notice', { body: $('#ad-notice').value }); msg(r.cleared ? '공지를 내렸어요.' : '공지를 올렸어요.'); } catch (e) { msg(olErr(e)); } };
    $$('[data-ak]').forEach((r) => (r.onclick = () => this.olAdminKid(r.dataset.ak, q)));
  },
  async olAdminKid(id, q) {
    let sc = [], k;
    try { [sc, k] = await Promise.all([Online.rpc('admin_child_scores', { child: id }), Online.rpc('admin_find_children', { q }).then((l) => (l || []).find((x) => x.id === id))]); } catch (e) { return this.olAdmin(q); }
    if (!k) return this.olAdmin(q);
    this.modal(`<h2>🛠️ ${escapeHtml(k.nickname)}</h2><p class="muted">LV${k.level} · 친구 코드 ${k.friend_code} · 가입 ${new Date(k.created_at).toLocaleDateString('ko-KR')} · ${k.games}판</p>
      <div class="switch"><span>닉네임 바꾸기</span><span class="row"><input class="ol-inline" id="ad-nick" maxlength="10" value="${escapeHtml(k.nickname)}"><button class="btn sm blue" id="ad-ren">바꾸기</button></span></div>
      <div class="switch"><span>이 아이 점수 모두 지우기 <span class="muted">(랭킹에서 빠져요)</span></span><button class="btn sm gray" id="ad-clr">모두 지우기</button></div>
      <h3>점수 (높은 순)</h3>${sc.length ? sc.map((s) => `<div class="wn ol-row"><span>${WORLDS[s.world] ? WORLDS[s.world].icon : ''} <b>${s.score}점</b> <span class="muted">${s.rnk}/${s.n}등 · ${fmtTime(s.time_s)} · ${new Date(s.created_at).toLocaleString('ko-KR')}</span></span><button class="btn sm gray" data-ds="${s.id}">지우기</button></div>`).join('') : '<p class="muted">점수가 없어요.</p>'}
      <div class="ol-msg" id="ol-msg"></div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm gray" id="ad-back">← 관리자 모드</button></div>`);
    const msg = (t) => { $('#ol-msg').textContent = t; };
    $('#ad-back').onclick = () => this.olAdmin(q);
    $('#ad-ren').onclick = async () => { try { await Online.call('admin_rename_child', { child: id, nick: $('#ad-nick').value }); msg('닉네임을 바꿨어요.'); } catch (e) { msg(olErr(e)); } };
    $('#ad-clr').onclick = async (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '정말 지울까요?'; return; } try { await Online.call('admin_clear_scores', { child: id }); this.olAdminKid(id, q); } catch (er) { msg(olErr(er)); } };
    $$('[data-ds]').forEach((b) => (b.onclick = async () => { try { await Online.call('admin_delete_score', { score_id: +b.dataset.ds }); this.olAdminKid(id, q); } catch (er) { msg(olErr(er)); } }));
  },
  // notice from the operator, shown once when a child enters the plaza
  async olNotice() {
    if (!Online.enabled || !Online.ready || this._noticeBusy) return; this._noticeBusy = true;
    try {
      const r = await Online.rpc('get_notice'); const n = r && r[0];
      if (n && String(n.id) !== LS.get('malangrace.notice') && this.screen === 'hub' && $('#modal').classList.contains('hidden')) {
        this.modal(`<h2>📢 알림</h2><p style="font-size:20px;line-height:1.5">${escapeHtml(n.body)}</p><div class="row" style="justify-content:center"><button class="btn" id="nt-ok">알겠어요</button></div>`);
        $('#nt-ok').onclick = () => { LS.set('malangrace.notice', String(n.id)); this.closeModal(); };
      }
    } catch (e) {}
    this._noticeBusy = false;
  },
  async olParent(tab = 'kids') {
    if (tab === 'admin') return this.olAdmin();
    const tabs = [['kids', '📊 아이 기록'], ['friends', '🤝 친구 승인'], ['rules', '⏰ 사용 규칙'], ['account', '🔑 계정']]; if (Online.admin) tabs.push(['admin', '🛠️ 관리자']);
    const head = `<h2>👨‍👩‍👧 보호자 메뉴</h2><div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? 'on' : ''}" data-pt="${k}">${n}</button>`).join('')}</div>`;
    this.modal(head + '<p class="muted">불러오는 중…</p>');
    const bind = () => { $$('[data-pt]').forEach((b) => (b.onclick = () => this.olPin(() => this.olParent(b.dataset.pt)))); if ($('#ol-back')) $('#ol-back').onclick = () => this.olPickChild(); };
    let body = '';
    try {
      await Online.loadFamily(); const K = Online.children;
      if (tab === 'kids') {
        const { data: saves } = await Online.sb.from('saves').select('child_id,data');
        const byId = {}; (saves || []).forEach((s) => (byId[s.child_id] = s.data));
        body = K.length ? K.map((k) => this.olKidReport(k, byId[k.id])).join('') : '<p>아직 등록한 아이가 없어요.</p>';
      } else if (tab === 'friends') {
        const req = await Online.rpc('guardian_requests');
        body = `<h3>승인을 기다리는 친구 신청</h3>${req.length ? req.map((r) => `<div class="wn ol-row"><span><b>${escapeHtml(r.from_nickname)}</b> (LV${r.from_level}) → 우리 <b>${escapeHtml(r.to_nickname)}</b></span><span class="row"><button class="btn sm green" data-ok="${r.fid}">승인</button><button class="btn sm gray" data-no="${r.fid}">거절</button></span></div>`).join('') : '<p class="muted">새 신청이 없어요.</p>'}
          <p class="muted">아이가 친구 코드를 넣으면 상대 보호자에게 신청이 가요. 승인된 친구끼리만 랭킹을 보고 친구 방에서 함께 달릴 수 있어요. 대화는 정해진 이모티콘만 돼요.</p>`;
        for (const k of K) {
          const fr = await Online.rpc('my_friends', { child: k.id }); const ok = fr.filter((f) => f.status === 'approved');
          body += `<h3>${escapeHtml(k.nickname)}의 친구 (${ok.length})</h3>${ok.length ? ok.map((f) => `<div class="wn ol-row"><span>${blobHtml(f.look && f.look.c, 24)} ${escapeHtml(f.nickname)} · LV${f.level}</span><button class="btn sm gray" data-rm="${f.fid}">친구 끊기</button></div>`).join('') : '<p class="muted">아직 친구가 없어요.</p>'}`;
        }
      } else if (tab === 'rules') {
        body = K.map((k) => { const c = k.controls || {}; const dm = +c.daily_min || 0;
          return `<div class="wn" data-kid="${k.id}"><div class="row" style="justify-content:space-between"><b style="font-size:19px">${blobHtml(k.look && k.look.c, 26)} ${escapeHtml(k.nickname)}</b><span class="muted">친구 코드 ${k.friend_code}</span></div>
            <div class="switch"><span>하루 놀이 시간</span><span class="row">${[0, 30, 60, 90, 120].map((m) => `<button class="chip sm ${m === dm ? 'on' : ''}" data-dm="${m}">${m ? m + '분' : '제한 없음'}</button>`).join('')}</span></div>
            <div class="switch"><span>이모티콘 주고받기</span><button class="btn sm ${c.emotes !== false ? 'green' : 'gray'}" data-em="${c.emotes !== false ? 1 : 0}">${c.emotes !== false ? '켜짐' : '꺼짐'}</button></div>
            <div class="switch"><span>친구 방 (승인한 친구와 실시간 달리기)</span><button class="btn sm ${c.rooms !== false ? 'green' : 'gray'}" data-rmo="${c.rooms !== false ? 1 : 0}">${c.rooms !== false ? '켜짐' : '꺼짐'}</button></div>
            <div class="switch"><span>닉네임</span><span class="row"><input class="ol-inline" data-nick value="${escapeHtml(k.nickname)}" maxlength="10"><button class="btn sm blue" data-save>저장</button></span></div>
            <div class="switch"><span>이 아이 지우기 <span class="muted">(기록 모두 삭제)</span></span><button class="btn sm gray" data-del>지우기</button></div></div>`; }).join('') + '<p class="muted">놀이 시간은 이 아이가 게임 화면을 켜 둔 시간이에요. 시간이 다 되면 새 레이스를 시작할 수 없고, 하던 레이스는 끝까지 할 수 있어요.</p>';
      } else {
        body = `<div class="switch"><span>보호자 이메일</span><b>${escapeHtml(Online.email)}</b></div>
          <div class="switch"><span>PIN 바꾸기</span><span class="row"><input class="ol-inline" id="np1" type="password" inputmode="numeric" maxlength="4" placeholder="새 PIN"><button class="btn sm blue" id="ol-np">바꾸기</button></span></div>
          <div class="switch"><span>로그아웃</span><button class="btn sm gray" id="ol-out">로그아웃</button></div>
          <div class="switch"><span>계정과 모든 기록 지우기 <span class="muted">(되돌릴 수 없어요)</span></span><button class="btn sm gray" id="ol-wipe">계정 지우기</button></div>
          <p class="muted">동의일: ${Online.guardian ? new Date(Online.guardian.consent_at).toLocaleDateString('ko-KR') : '-'}</p>`;
      }
    } catch (e) { body = `<p class="ol-msg bad">${olErr(e)}</p>`; }
    this.modal(head + body + '<div class="ol-msg" id="ol-msg"></div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm gray" id="ol-back">← 아이 고르기</button></div>');
    bind();
    const msg = (t) => { const m = $('#ol-msg'); if (m) m.textContent = t; };
    const act = async (fn, args, after) => { try { await Online.call(fn, Object.assign({ pin: Online.pin }, args)); Online.pinT = Date.now(); if (after) after(); else this.olParent(tab); } catch (e) { if (e && /pin/.test(e.err)) Online.pin = null; msg(olErr(e)); } };
    $$('[data-ok]').forEach((b) => (b.onclick = () => act('respond_friend_request', { fid: +b.dataset.ok, approve: true })));
    $$('[data-no]').forEach((b) => (b.onclick = () => act('respond_friend_request', { fid: +b.dataset.no, approve: false })));
    $$('[data-rm]').forEach((b) => (b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '정말 끊을까요?'; return; } act('remove_friend', { fid: +b.dataset.rm }); }));
    $$('[data-kid]').forEach((box) => {
      const id = box.dataset.kid, k = Online.children.find((x) => x.id === id), c = Object.assign({ daily_min: 0, emotes: true, rooms: true }, k.controls || {});
      const setC = (patch) => act('guardian_update_child', { child: id, nick: null, controls: Object.assign(c, patch) }, () => { if (Online.child && Online.child.id === id) Online.child.controls = c; this.olParent('rules'); });
      $$('[data-dm]', box).forEach((b) => (b.onclick = () => setC({ daily_min: +b.dataset.dm })));
      $('[data-em]', box).onclick = (e) => setC({ emotes: e.currentTarget.dataset.em !== '1' });
      $('[data-rmo]', box).onclick = (e) => setC({ rooms: e.currentTarget.dataset.rmo !== '1' });
      $('[data-save]', box).onclick = () => act('guardian_update_child', { child: id, nick: $('[data-nick]', box).value, controls: null }, async () => { await Online.loadFamily(); if (Online.child && Online.child.id === id && Save.data.profile) { Save.data.profile.nick = Online.child.nickname; Save.save(); } this.olParent('rules'); });
      $('[data-del]', box).onclick = (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '정말 지울까요? 한 번 더'; return; } act('delete_child', { child: id }, async () => { LS.del('malangrace.save.c.' + id); if (Online.child && Online.child.id === id) Online.goOffline(); await Online.loadFamily(); this.olParent('rules'); }); };
    });
    if ($('#ol-np')) $('#ol-np').onclick = async () => { const np = $('#np1').value; try { await Online.call('change_pin', { old_pin: Online.pin, new_pin: np }); Online.pin = np; Online.pinT = Date.now(); msg('PIN을 바꿨어요.'); } catch (e) { msg(olErr(e)); } };
    if ($('#ol-out')) $('#ol-out').onclick = async () => { if (this.room) this.leaveRoom(true); await Online.signOut(); this.refreshPlayerLook(); this.closeModal(); this.show('title'); this.drawTitleOnline(); };
    if ($('#ol-wipe')) $('#ol-wipe').onclick = (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '모든 기록이 사라져요. 한 번 더 누르기'; return; }
      act('delete_my_account', {}, async () => { Online.children.forEach((k) => LS.del('malangrace.save.c.' + k.id)); await Online.signOut(); this.refreshPlayerLook(); this.closeModal(); this.show('title'); this.drawTitleOnline(); }); };
  },
  olKidReport(k, d) {
    if (!d || !d.profile) return `<div class="wn"><b>${escapeHtml(k.nickname)}</b> · 아직 게임 기록이 없어요. (친구 코드 ${k.friend_code})</div>`;
    const t = d.stats.total, acc = t.a ? Math.round(t.c / t.a * 100) : 0, log = d.playLog || {};
    const days = Array.from({ length: 7 }, (_, i) => { const dt = new Date(Date.now() - (6 - i) * 864e5); const key = todayStrOf(dt); return { key, label: ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()], sec: log[key] || 0 }; });
    const mx = Math.max(600, ...days.map((x) => x.sec));
    const types = Object.entries(d.stats.byType || {}).filter(([, v]) => v.a >= 3).map(([id, v]) => ({ id, acc: v.c / v.a, a: v.a })).sort((a, b) => a.acc - b.acc);
    const tname = (id) => (QTYPES[id] ? QTYPES[id].name : id);
    const open = (d.wrongNotes || []).filter((w) => !w.resolved);
    const recent = (d.history || []).slice(0, 5);
    return `<div class="wn ol-report"><div class="row" style="justify-content:space-between"><b style="font-size:20px">${blobHtml(k.look && k.look.c, 30)} ${escapeHtml(k.nickname)} <span class="muted">LV${d.profile.level} ${LEVELS[d.profile.level].name}</span></b><span class="muted">친구 코드 ${k.friend_code}</span></div>
      <div class="ol-stats"><div>완주<b>${d.stats.races}</b></div><div>1등<b>${d.stats.wins}</b></div><div>정답률<b>${acc}%</b></div><div>오늘<b>${minFmt(log[todayStr()])}</b></div><div>남은 오답<b>${open.length}</b></div></div>
      <div class="ol-week">${days.map((x) => `<div><i style="height:${Math.round(x.sec / mx * 100)}%"></i><small>${x.label}</small><small>${Math.round(x.sec / 60)}분</small></div>`).join('')}</div>
      ${types.length ? `<p><b>더 연습하면 좋은 유형</b> ${types.slice(0, 3).map((x) => `${escapeHtml(tname(x.id))} ${Math.round(x.acc * 100)}%`).join(' · ')}</p>` : ''}
      ${open.length ? `<details><summary>남은 오답 ${open.length}개 보기</summary>${open.slice(0, 12).map((w) => `<div class="ol-note">${escapeHtml(w.text)} → 정답 <b>${escapeHtml(w.answer)}</b> <span class="muted">(고른 답 ${escapeHtml(w.chosen)})</span></div>`).join('')}</details>` : ''}
      ${recent.length ? `<details><summary>최근 레이스</summary>${recent.map((h) => `<div class="ol-note">${new Date(h.date).toLocaleDateString('ko-KR')} ${WORLDS[h.world] ? WORLDS[h.world].icon : ''} ${h.rank}등/${h.N} · 정답 ${h.correct}/${h.attempts} · ${h.score}점</div>`).join('')}</details>` : ''}</div>`;
  },
  // ---------------- rankings and friends (child side) ----------------
  menuRankLocal: App.menuRank,
  async menuRank(tab) {
    if (!Online.child) return this.menuRankLocal();
    tab = tab || this._rankTab || 'all-week'; this._rankTab = tab;
    const tabs = [['all-week', '🌍 이번 주'], ['all-all', '🏅 최고 기록'], ['friends-week', '👫 친구 이번 주'], ['friends', '🤝 친구'], ['me', '📒 내 기록']];
    const head = `<h2>🏆 랭킹</h2><div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? 'on' : ''}" data-rt="${k}">${n}</button>`).join('')}</div>`;
    if (tab === 'me') { this.menuRankLocal(); $('#modal-panel h2').insertAdjacentHTML('afterend', `<div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? 'on' : ''}" data-rt="${k}">${n}</button>`).join('')}</div>`); $$('[data-rt]').forEach((b) => (b.onclick = () => this.menuRank(b.dataset.rt))); return; }
    this.modal(head + '<p class="muted">불러오는 중…</p>');
    let body = '';
    try {
      if (tab === 'friends') {
        const fr = await Online.rpc('my_friends', { child: Online.child.id });
        body = `<div class="ol-code">내 친구 코드 <b>${Online.child.friend_code}</b> <button class="btn sm blue" id="ol-copy">복사</button></div>
          <div class="row"><input class="ol-inline" id="ol-fcode" maxlength="6" placeholder="친구 코드 6자리" style="text-transform:uppercase;flex:1"><button class="btn sm" id="ol-fadd">친구 신청</button></div><div class="ol-msg" id="ol-msg"></div>
          ${fr.length ? fr.map((f) => `<div class="wn ol-row"><span>${blobHtml(f.look && f.look.c, 26)} <b>${escapeHtml(f.nickname)}</b> · LV${f.level}</span><span class="tag ${f.status === 'approved' ? 'green' : ''}">${f.status === 'approved' ? '친구' : f.incoming ? '우리 보호자님 승인 대기' : '친구 보호자님 승인 대기'}</span></div>`).join('') : '<p class="muted">친구 코드를 서로 알려 주고 신청해 보세요. 보호자님이 승인하면 친구가 돼요.</p>'}`;
      } else {
        const [scope, period] = tab.split('-');
        const rows = await Online.rpc('leaderboard', { child: Online.child.id, scope, period: period || 'week' });
        body = (period === 'week' ? '<p class="muted">이번 주(월요일부터) 잘한 레이스 10판의 점수를 더해요.</p>' : '<p class="muted">지금까지 가장 잘한 레이스 한 판의 점수예요.</p>') +
          (rows.length ? rows.map((r) => `<div class="wn ol-lb ${r.is_me ? 'me' : ''}"><b class="pos">${r.pos}</b>${blobHtml(r.look && r.look.c, 28)}<span class="nm">${escapeHtml(r.nickname)}${r.is_me ? ' (나)' : ''}</span><span class="muted">LV${r.level}</span><b>${r.points}점</b></div>`).join('') : '<p class="muted">아직 기록이 없어요. 레이스를 완주하면 올라가요!</p>') +
          (rows.some((r) => r.is_me) ? '' : '<p class="muted">레이스를 완주하면 내 이름도 올라가요.</p>');
      }
    } catch (e) { body = `<p class="ol-msg bad">${olErr(e)}</p>`; }
    this.modal(head + body + '<p class="muted">점수는 서버가 순위·정답률·학년 레벨로 다시 계산해요. 랭킹에는 닉네임과 말랑이 색만 보여요.</p>');
    $$('[data-rt]').forEach((b) => (b.onclick = () => this.menuRank(b.dataset.rt)));
    if ($('#ol-copy')) $('#ol-copy').onclick = () => { try { navigator.clipboard.writeText(Online.child.friend_code); } catch (e) {} $('#ol-copy').textContent = '복사됨'; };
    if ($('#ol-fadd')) $('#ol-fadd').onclick = async () => { const code = $('#ol-fcode').value.trim().toUpperCase(); try { const r = await Online.call('send_friend_request', { child: Online.child.id, code }); this.menuRank('friends'); setTimeout(() => { const m = $('#ol-msg'); if (m) m.textContent = `${r.nickname}에게 신청했어요. 친구의 보호자님이 승인하면 친구가 돼요.`; }, 300); } catch (e) { $('#ol-msg').textContent = olErr(e); } };
  },
  drawCloud() { const el = $('#hub-cloud'); if (!el) return; if (!Online.child) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.textContent = Online.syncState === 'err' ? '☁️ 저장 대기' : '☁️ 저장됨'; },
  olTimeUpModal() {
    this.modal(`<div style="text-align:center"><div style="font-size:64px">⏰</div><h2>오늘 놀이 시간이 끝났어요</h2><p>보호자님이 정한 하루 ${Online.limitMin()}분을 다 썼어요.<br>내일 또 신나게 달려요!</p><button class="btn" onclick="App.closeModal()">알겠어요</button></div>`);
  },
});
function todayStrOf(d) { const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
