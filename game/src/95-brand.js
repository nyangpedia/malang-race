// ================================================================
// Brand (event) mode. Only active when the build injects a BRAND object
// (node build.js --brand brands/<file>.json). The normal game is untouched.
//
// Made for an event booth: one tablet or PC, many visitors taking turns.
// Title (brand logo) -> nickname + colour -> one quiz race with the brand's
// own questions -> result with reward and this device's top 10 -> next visitor.
// Nothing is sent to a server; records stay on the device.
// ================================================================
if (typeof BRAND !== 'undefined' && BRAND) (function () {
  const B = BRAND, C = B.colors || {};
  const boardKey = 'malangrace.brand.' + B.id + '.board';
  Save.key = 'malangrace.brand.' + B.id + '.save';
  document.title = B.title || B.name;

  // ---------- colours: page UI ----------
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const main = C.main || '#ff5fa2', sub = C.sub || '#3fa9ff';
  const css = document.createElement('style');
  css.textContent = `:root{--pink:${main};--pink2:${shade(main, 0.35)};--blue:${sub};${C.ink ? `--ink:${C.ink};--ink2:${shade(C.ink, 0.35)};` : ''}${C.bg1 ? `--bg1:${C.bg1};` : ''}${C.bg2 ? `--bg2:${C.bg2};` : ''}}
    .btn{background:linear-gradient(180deg,${shade(main, 0.25)},${main});box-shadow:0 6px 0 ${shade(main, -0.25)},0 10px 20px ${main}55}
    .btn.blue{background:linear-gradient(180deg,${shade(sub, 0.25)},${sub});box-shadow:0 6px 0 ${shade(sub, -0.25)},0 10px 20px ${sub}4d}
    #screen-title,#screen-register{background:linear-gradient(160deg,var(--bg1),var(--bg2))}
    #screen-title .logo img{max-width:min(70vw,520px);max-height:30vh;display:block;margin:0 auto}
    #screen-title .logo span:nth-child(1){color:${main}}#screen-title .logo span:nth-child(2){color:${C.accent || '#ffd23f'}}
    #screen-title .en{color:${sub}}
    .brand-board{margin:10px auto 0;max-width:420px;width:100%;background:#fffd;border-radius:18px;padding:10px 14px;font-size:15px}
    .brand-board h3{margin:0 0 6px;font-size:17px;text-align:center}
    .brand-board .r{display:flex;gap:8px;padding:3px 0;border-bottom:1px dashed var(--line)}.brand-board .r:last-child{border:0}
    .brand-board .r b{width:26px}.brand-board .r span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .brand-board .r em{font-style:normal;flex:none}.brand-board .r.me{color:${shade(main, -0.25)};font-weight:bold}
    .brand-reward{margin:12px auto;max-width:440px;text-align:center;background:linear-gradient(180deg,#fff,${shade(main, 0.85)});border:3px dashed ${main};border-radius:18px;padding:12px}
    .brand-reward .code{font-size:28px;letter-spacing:3px;margin-top:6px;color:${shade(main, -0.3)}}
    #reg-age,#reg-level,.field:has(#reg-age),.field:has(#reg-level){display:none}`;
  document.head.appendChild(css);

  // ---------- colours: 3D course floor and rails ----------
  const W = WORLDS[B.world] ? B.world : 'candy';
  if (C.floor !== false) { const w = WORLDS[W]; w.floorA = main; w.floorB = shade(main, 0.6); w.rail = [main, '#ffffff']; w.accent = parseInt(main.slice(1), 16); w.side = parseInt(shade(main, -0.2).slice(1), 16); }

  // ---------- questions ----------
  // brand file: { q, a, wrong: [4 wrong answers], explain? } -> the game's question shape
  let deck = [];
  const nextQ = () => { if (!deck.length) deck = shuffle(B.questions.slice()); return deck.pop(); };
  window.makeSubjectQuestion = function () {
    const x = nextQ();
    return { text: x.q, answer: x.a, wrongs: shuffle(x.wrong.slice()), type: '퀴즈', cat: B.name, level: B.level || 3, textAnswer: true, explain: x.explain || '' };
  };
  SUBJECTS.quiz = { name: B.name + ' 퀴즈', icon: '💡', desc: '' };

  // ---------- this device's leaderboard ----------
  const board = { read() { try { return JSON.parse(localStorage.getItem(boardKey)) || []; } catch (e) { return []; } },
    add(row) { const l = this.read(); l.push(row); l.sort((a, b) => b.score - a.score || a.time - b.time); try { localStorage.setItem(boardKey, JSON.stringify(l.slice(0, 200))); } catch (e) {} return l; } };
  if (/[?&]reset=1/.test(location.search)) { try { localStorage.removeItem(boardKey); } catch (e) {} }
  const boardHtml = (list, meTs) => { const top = list.slice(0, 10); if (!top.length) return '';
    return `<div class="brand-board"><h3>🏆 오늘의 순위 TOP 10</h3>${top.map((r, i) => `<div class="r ${r.ts === meTs ? 'me' : ''}"><b>${i + 1}</b><span>${escapeHtml(r.nick)}</span><em>${r.score}점</em></div>`).join('')}</div>`; };

  const level = clamp(B.level || 3, 1, 6), racers = clamp(B.racers || 20, 5, 50);
  Object.assign(App, {
    drawTitleOnline() {
      const t = $('#screen-title');
      t.querySelector('.logo').innerHTML = B.logo ? `<img src="${B.logo}" alt="${escapeHtml(B.name)}">` : `<span>${escapeHtml(B.logoText ? B.logoText[0] : B.name)}</span><span>${escapeHtml(B.logoText ? B.logoText[1] || '' : '')}</span>`;
      t.querySelector('.en').textContent = B.title || '';
      t.querySelector('.sub').textContent = B.tagline || '퀴즈를 풀며 결승선까지 달려요!';
      $('#btn-start').classList.remove('hidden'); $('#btn-start').textContent = B.startLabel || '참여하기';
      $('#btn-online').classList.add('hidden');
      $('#title-online').innerHTML = boardHtml(board.read());
    },
    olBoot() { this.drawTitleOnline(); },
    olStart() { Save.reset(); this.showRegister(); },
    // after the nickname screen: straight into the race (no plaza)
    enterHub() { const P = Save.data.profile; if (!P) { this.showTitle(); return; } P.level = level; this.startRace(W, racers, 'quiz', true); },
    showTitle() { if (this.race) { this.race.dispose(); this.race = null; } $('#hud').classList.add('hidden'); $('#controls').classList.add('hidden'); $('#qpanel').classList.add('hidden'); $('#modal').classList.add('hidden'); this.paused = false; this.show('title'); this.drawTitleOnline(); },
    exitRace() { this.showTitle(); },
    nextPlayer() { Save.reset(); this.showTitle(); },
    showResults(res) {
      const pts = res.pts || { speed: 0, quiz: 0, star: 0, total: res.score };
      const ts = Date.now(), nick = (Save.data.profile && Save.data.profile.nick) || '참가자';
      const list = board.add({ nick, score: pts.total, rank: res.rank, time: res.time, correct: res.correct, ts });
      const pos = list.findIndex((r) => r.ts === ts) + 1;
      const R = B.reward, win = R && (!R.topN || pos <= R.topN);
      const tm = `${Math.floor(res.time / 60)}분 ${Math.floor(res.time % 60)}초`;
      this.modal(`<h2>🏁 ${escapeHtml(nick)}님 결과</h2><div class="res-rank">${pts.total}점</div>
        <div class="res-pts"><div>🏃 속도<b>${pts.speed}</b><small>${res.place || res.rank}번째 골인 · ${tm}</small></div><i>+</i><div>✏️ 정답<b>${pts.quiz}</b><small>${res.correct} / ${res.attempts} 문제</small></div><i>+</i><div>⭐ 별<b>${pts.star}</b><small>${res.stars || 0}개</small></div></div>
        <p style="text-align:center;font-size:18px">오늘 참가자 중 <b>${pos}위</b></p>
        ${win ? `<div class="brand-reward"><div><b>${escapeHtml(R.title || '참여 선물')}</b></div><div>${escapeHtml(R.text || '')}</div>${R.code ? `<div class="code">${escapeHtml(R.code)}</div>` : ''}</div>` : ''}
        ${boardHtml(list, ts)}
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn blue" onclick="App.restartRace();App.closeModal()">한 번 더</button><button class="btn" onclick="App.nextPlayer()">다음 참가자</button></div>
        ${B.cta && B.cta.url ? `<p style="text-align:center;margin-top:10px"><a href="${escapeHtml(B.cta.url)}" target="_blank" rel="noopener">${escapeHtml(B.cta.label || '자세히 보기')}</a></p>` : ''}`);
    },
  });
  // the pause menu says "plaza" in the normal game
  const tp = App.togglePause; App.togglePause = function () { tp.call(this); if (this.paused) $$('#modal-panel .btn.gray').forEach((b) => (b.textContent = '처음 화면으로')); };
  // the register screen: hide age and maths level, keep nickname and colour
  const sr = App.showRegister; App.showRegister = function (edit) { sr.call(this, edit); $('#btn-reg').textContent = '출발!'; $('#reg-note').textContent = '닉네임만 정하면 바로 달려요. 기록은 이 기기에만 남아요.'; };
})();
