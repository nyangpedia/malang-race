// ============================================================================
// Quick start: no guardian account. Each device signs in anonymously and holds one player
// (nickname, mallang look, game records). A restore code moves the player to another device.
// The old email login stays only behind a small link, for the operator and for accounts made before.
// ============================================================================
Object.assign(OL_ERR, {
  nick: '닉네임은 한글·영문·숫자 2~10글자로 써 주세요. 긴 숫자나 나쁜 말은 쓸 수 없어요.',
  no_restore: '그런 이어하기 코드가 없어요. 다시 확인해 주세요.', restore_locked: '코드를 여러 번 틀려서 10분 동안 잠겼어요.',
  anon_off: '서버 설정에서 익명 로그인이 꺼져 있어서 지금은 이 기기에만 저장돼요.',
});
Object.assign(Online, {
  async ensureSession() {
    if (this.session) return;
    const { data, error } = await this.sb.auth.signInAnonymously();
    if (error) { if (/anonymous/i.test(error.message || '')) throw { err: 'anon_off' }; throw error; }
    this.session = data.session;
  },
  // create (or find) this device's player and keep the save that is on screen now
  async quickStart() {
    const P = Save.data.profile; if (!P) return null;
    await this.ensureSession();
    const r = await this.call('quick_start', { nick: P.nick, look: this.lookMini(), lvl: P.level });
    await this.loadFamily();
    const c = this.children.find((k) => k.id === r.child.id) || r.child;
    this.adopt(c); return c;
  },
  adopt(child) {
    const d = Save.data; this.child = child; LS.set('malangrace.child', child.id);
    Save.key = 'malangrace.save.c.' + child.id; Save.use(d);
    if (Save.data.profile) Save.data.profile.nick = child.nickname;
    this._pushed = ''; Save.save(true);
  },
  async restore(code) {
    await this.ensureSession();
    const r = await this.call('restore_account', { code });
    await this.loadFamily();
    const c = this.children.find((k) => k.id === r.child.id) || r.child;
    await this.activate(c); return c;
  },
});

Object.assign(App, {
  drawTitleOnline() {
    const b = $('#btn-online'), st = $('#title-online'); if (!b) return;
    $('#btn-start').classList.remove('hidden');
    if (!Online.enabled) { b.classList.add('hidden'); st.textContent = ''; $('#btn-start').textContent = '시작하기'; return; }
    b.classList.remove('hidden'); b.textContent = '📱 다른 기기에서 하던 기록 가져오기';
    if (Online.child) { st.textContent = `☁️ ${Online.child.nickname}의 기록은 서버에 저장돼요`; $('#btn-start').textContent = `▶ ${Online.child.nickname} 시작`; }
    else { st.textContent = '닉네임만 정하면 바로 시작해요. 기록은 서버에 저장되고 친구와 같이 달릴 수 있어요'; $('#btn-start').textContent = '시작하기'; }
  },
  async olBoot() {
    await Online.init();
    if (Online.enabled && Online.session && Online.children.length) {
      const id = Online.lastChildId(), c = Online.children.find((k) => k.id === id) || Online.children[0];
      await Online.activate(c);
    } else if (Online.enabled && Save.data.profile) {
      try { await Online.quickStart(); } catch (e) { console.warn('quick start', e); }
    }
    this.refreshPlayerLook(); this.drawTitleOnline();
  },
  olStart() { if (Save.data.profile) this.enterHub(); else this.showRegister(); },
  olAfterLogin() { // email login (operator, or an account made before)
    this.drawTitleOnline(); if (!Online.email || !Online.guardian) return; // anonymous sign-in is handled by quickStart
    if (Online.children.length === 1) { Online.activate(Online.children[0]).then(() => { this.refreshPlayerLook(); this.closeModal(); this.drawTitleOnline(); if (Save.data.profile) this.enterHub(); else this.showRegister(); }); }
    else this.olPickChild();
  },
  olRegisterGuardian() { this.closeModal(); this.drawTitleOnline(); },
  // title button and settings: bring a player over from another device
  olEntry() {
    this.modal(`<h2>📱 다른 기기 기록 가져오기</h2>
      <p>다른 기기의 <b>⚙️ 설정</b>에 있는 <b>이어하기 코드</b> 8자리를 넣어 주세요. 그 기기에서 하던 말랑이와 기록을 이 기기로 가져와요.</p>
      <div class="row"><input class="ol-inline" id="rs-code" maxlength="9" placeholder="이어하기 코드 8자리" style="text-transform:uppercase;flex:1;font-size:20px;letter-spacing:2px"><button class="btn sm" id="rs-go">가져오기</button></div>
      <div class="ol-msg" id="ol-msg"></div>
      <p class="muted" style="margin-top:14px">운영자이거나 예전에 이메일 계정을 만들었다면 <a href="#" id="rs-old">이메일로 로그인</a></p>`);
    $('#modal-panel').classList.add('narrow');
    $('#rs-go').onclick = async () => {
      const m = $('#ol-msg'), code = $('#rs-code').value.trim(); if (code.replace(/[^A-Za-z0-9]/g, '').length !== 8) { m.textContent = '코드 8자리를 써 주세요.'; return; }
      $('#rs-go').disabled = true; m.textContent = '가져오는 중…';
      try { const c = await Online.restore(code); this.refreshPlayerLook(); this.drawTitleOnline(); this.closeModal(); if (Save.data.profile) this.enterHub(); else this.showRegister(); this.toastHub(`${c.nickname}의 기록을 가져왔어요! ☁️`); }
      catch (e) { m.textContent = olErr(e); $('#rs-go').disabled = false; }
    };
    $('#rs-old').onclick = (e) => { e.preventDefault(); this.olAuth('login'); };
  },
  // after the register screen: connect to the server, or rename on the server
  async afterRegister(edit) {
    if (!Online.enabled) return;
    const P = Save.data.profile; if (!P) return;
    try {
      if (!Online.child) { await Online.quickStart(); this.drawTitleOnline(); this.drawHub && this.drawHub(); return; }
      if (P.nick !== Online.child.nickname) { await Online.call('rename_me', { child: Online.child.id, nick: P.nick }); Online.child.nickname = P.nick; this.toastHub('닉네임을 바꿨어요'); }
    } catch (e) {
      if (e && e.err === 'nick') { if (Online.child) P.nick = Online.child.nickname; Save.save(); this.toastHub(OL_ERR.nick); setTimeout(() => this.showRegister(true), 600); }
      else this.toastHub(olErr(e));
    }
  },
  menuAccount() {
    const C = Online.child;
    this.modal(`<h2>☁️ 내 계정</h2>
      ${C ? `<div class="ol-code">이어하기 코드 <b>${escapeHtml((C.restore_code || '').replace(/^(.{4})/, '$1-'))}</b> <button class="btn sm blue" id="ac-copy">복사</button></div>
      <p class="muted" style="text-align:center">다른 기기에서 <b>📱 다른 기기에서 하던 기록 가져오기</b>를 누르고 이 코드를 넣으면 이어서 할 수 있어요. 코드는 다른 사람에게 알려 주지 마세요.</p>` : `<p>아직 서버에 연결되지 않았어요. 지금은 이 기기에만 저장돼요.</p><div class="row" style="justify-content:center"><button class="btn" id="ac-link">서버에 연결하기</button></div>`}
      <div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm" id="ac-restore">📱 다른 기기 기록 가져오기</button>${C ? '<button class="btn sm gray" id="ac-del">계정과 기록 지우기</button>' : ''}</div>
      <div class="ol-msg" id="ol-msg"></div>
      <p class="muted">서버에는 닉네임, 말랑이 모습, 게임 기록만 저장해요. 이메일, 실명, 생년월일, 전화번호는 받지 않아요.</p>`);
    if ($('#ac-copy')) $('#ac-copy').onclick = () => { try { navigator.clipboard.writeText(C.restore_code); } catch (e) {} $('#ac-copy').textContent = '복사됨'; };
    if ($('#ac-link')) $('#ac-link').onclick = async () => { try { await Online.quickStart(); this.drawTitleOnline(); this.menuAccount(); } catch (e) { $('#ol-msg').textContent = olErr(e); } };
    $('#ac-restore').onclick = () => this.olEntry();
    if ($('#ac-del')) $('#ac-del').onclick = async () => {
      const b = $('#ac-del'); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '정말 지울까요? 한 번 더 누르기'; return; }
      try { const id = C.id; await Online.call('delete_me'); LS.del('malangrace.save.c.' + id); await Online.signOut(); Save.reset(); Save.save(true); setTimeout(() => location.reload(), 600); } catch (e) { $('#ol-msg').textContent = olErr(e); }
    };
  },
});
