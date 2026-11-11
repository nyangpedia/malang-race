// ================================================================
// Lobby (말랑 광장) 3D scene, hub UI, illustrated world map, starter colour
// ================================================================
const STARTER_COLORS = ['pink', 'sky', 'lemon', 'mint', 'grape', 'peach', 'lime', 'coral'];
const hexCss = (h) => '#' + h.toString(16).padStart(6, '0');
const MAP_ART = {
  candy: { c: ['#ffb6dc', '#ff86c0'], deco: [['🍭', -48, -4, 58], ['🧁', 6, -30, 52], ['🍬', 52, 6, 40]] },
  block: { c: ['#ffe08a', '#ffbf4d'], deco: [['🧱', -46, 0, 46], ['🏗️', 4, -30, 56], ['🎲', 52, 6, 40]] },
  jungle: { c: ['#b6ee7c', '#62c96a'], deco: [['🌴', -44, -10, 60], ['🌴', 8, -32, 50], ['🍄', 52, 8, 38]] },
  cloud: { c: ['#f4f7ff', '#c4d2ff'], deco: [['☁️', -46, -2, 52], ['🌈', 4, -30, 56], ['🎈', 54, 0, 40]] },
  crystal: { c: ['#d3c4ff', '#9a84ff'], deco: [['💎', -46, 0, 46], ['🔮', 4, -30, 54], ['❄️', 52, 6, 40]] },
  space: { c: ['#8f9bf0', '#4a4fb8'], deco: [['🪐', -46, -4, 52], ['🚀', 6, -32, 56], ['⭐', 54, 4, 36]] },
};
function blobSvg(color, s = 1) {
  return `<g transform="scale(${s})"><path d="M0,-36 C20,-36 36,-12 36,6 C36,24 22,30 0,30 C-22,30 -36,24 -36,6 C-36,-12 -20,-36 0,-36Z" fill="${color}" stroke="#fff" stroke-width="5"/><ellipse cx="-12" cy="-14" rx="9" ry="6" fill="#fff" opacity=".55"/><circle cx="-11" cy="4" r="4.5" fill="#3a2350"/><circle cx="11" cy="4" r="4.5" fill="#3a2350"/><path d="M-6,13 Q0,19 6,13" fill="none" stroke="#3a2350" stroke-width="3" stroke-linecap="round"/><circle cx="-20" cy="12" r="5" fill="#ff8fb8" opacity=".6"/><circle cx="20" cy="12" r="5" fill="#ff8fb8" opacity=".6"/></g>`;
}
function playerColorCss() { const e = Save.data.equip; const cs = COSTUMES[e.costume]; return hexCss((cs && cs.color) || (COLORS[e.color] || COLORS.pink).hex); }

Object.assign(App, {
  // ---------------- lobby 3D ----------------
  buildHub() {
    const sc = new THREE.Scene(); sc.environment = this.envMap; sc.add(makeSky(0x6fb4ff, 0xffe3f3)); sc.fog = new THREE.Fog(0xffe9f6, 50, 190);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xe6c8ff, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.3); sun.position.set(-14, 24, 16); sc.add(sun);
    if (this.renderer.shadowMap.enabled) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = -27; c.right = 27; c.top = 27; c.bottom = -27; c.near = 1; c.far = 90; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; }
    const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 700);
    const Y0 = -0.6, add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); sc.add(m); return m; };
    // floating island: grass, frosting rim, candy rock underneath
    const IR = 21; // island radius
    const grassT = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#8fdb78'; g.fillRect(0, 0, w, h); for (let k = 0; k < 90; k++) { g.fillStyle = k % 3 ? 'rgba(112,200,98,0.55)' : 'rgba(178,236,140,0.6)'; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(14, 46), rand(10, 30), rand(0, 3), 0, 6.3); g.fill(); } }, true); grassT.repeat.set(3, 3);
    add(new THREE.Mesh(new THREE.CylinderGeometry(IR, IR - 0.6, 1.2, 72), [mat(0x9bdd84, { roughness: 0.95 }), mat(0xffffff, { map: grassT, roughness: 0.95 }), mat(0x9bdd84)]), 0, Y0 - 0.6, 0);
    const rimM = jellyMaterial(0xfff6fb); const frost = add(new THREE.Mesh(new THREE.TorusGeometry(IR - 0.25, 0.75, 12, 72), rimM), 0, Y0 - 0.95, 0); frost.rotation.x = Math.PI / 2;
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2 + rand(-0.05, 0.05), d = new THREE.Mesh(GEO.sphereLo, rimM); d.scale.set(0.8, rand(0.9, 2.2), 0.8); add(d, Math.cos(a) * (IR - 0.25), Y0 - 1.5, Math.sin(a) * (IR - 0.25)); }
    add(new THREE.Mesh(new THREE.CylinderGeometry(IR - 0.7, 13, 6, 40), mat(0xffb3d6, { roughness: 0.8 })), 0, Y0 - 4.2, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(13, 2, 9, 32), mat(0xd98fd0, { roughness: 0.8 })), 0, Y0 - 11.7, 0);
    // plaza
    const chk = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#fff5fb'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd3ea'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128); }, true); chk.repeat.set(5, 5);
    const plaza = add(new THREE.Mesh(new THREE.CircleGeometry(8.2, 64), mat(0xffffff, { map: chk, roughness: 0.5 })), 0, Y0 + 0.02, 0); plaza.rotation.x = -Math.PI / 2;
    const prim = add(new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.26, 10, 64), jellyMaterial(0xff9ccf)), 0, Y0 + 0.05, 0); prim.rotation.x = Math.PI / 2;
    // glowing ring under the player
    const glowG = new THREE.RingGeometry(1.25, 1.6, 40); glowG.rotateX(-Math.PI / 2);
    const glow = add(new THREE.Mesh(glowG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })), 0, Y0 + 0.04, 0);
    // race portal behind the podium
    const portal = new THREE.Group(); portal.position.set(0, Y0, -16.4); sc.add(portal);
    const rb = [0xff5a7a, 0xff9a3c, 0xffd23f, 0x4fcf5f, 0x3fb4ff, 0xa86bff];
    rb.forEach((c, i) => { const seg = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.62, 12, 12, Math.PI / 6 + 0.02), jellyMaterial(c)); seg.rotation.z = i * Math.PI / 6; portal.add(seg); });
    const swirlTex = canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 6, 128, 128, 128); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#ffd9f0'); gr.addColorStop(0.75, '#a9d8ff'); gr.addColorStop(1, 'rgba(180,160,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 7; g.lineCap = 'round'; for (let k = 0; k < 5; k++) { g.beginPath(); for (let t = 0; t < 60; t++) { const a = k * 1.256 + t * 0.09, r = 8 + t * 1.9; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } });
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(4.3, 48, 0, Math.PI), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })); swirl.position.z = -0.1; portal.add(swirl);
    const swirl2 = new THREE.Mesh(new THREE.CircleGeometry(4.3, 48), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, depthWrite: false, opacity: 0.0 })); portal.add(swirl2);
    const signTex = canvasTex(512, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(6, 6, 500, 116, 50) : g.rect(6, 6, 500, 116); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ff7eb6'; g.stroke(); g.font = `bold 76px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff4f9a'; g.fillText('🏁 레이스 출발!', 256, 70); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: signTex, transparent: true })); sign.position.set(0, 6.3, 0.3); portal.add(sign);
    const laneTex = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ff9ccf'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); }, true); laneTex.repeat.set(3, 8);
    const lane = add(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 8.6), mat(0xffffff, { map: laneTex, roughness: 0.5 })), 0, Y0 + 0.035, -12.4); lane.rotation.x = -Math.PI / 2;
    // lamp posts
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.39, x = Math.cos(a) * 9.4, z = Math.sin(a) * 9.4; const p = new THREE.Mesh(GEO.cyl, mat(0xffffff)); p.scale.set(0.09, 2.6, 0.09); add(p, x, Y0 + 1.3, z); const b = new THREE.Mesh(GEO.sphere, lampM); b.scale.setScalar(0.32); add(b, x, Y0 + 2.75, z); const cp = new THREE.Mesh(GEO.cone, jellyMaterial(rb[i % 6])); cp.scale.set(0.42, 0.34, 0.42); add(cp, x, Y0 + 3.15, z); }
    const spots = [], solids = [], labels = [];
    // fountain in the middle of the plaza
    { const f = new THREE.Group(); f.position.set(0, Y0, 0); sc.add(f); const wm = jellyMaterial(0xffffff), wt = new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.85 });
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.25, 0.7, 36), wm); basin.position.y = 0.35; f.add(basin);
      const w1 = new THREE.Mesh(new THREE.CircleGeometry(1.85, 36), wt); w1.rotation.x = -Math.PI / 2; w1.position.y = 0.72; f.add(w1);
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.7, 16), jellyMaterial(0xffc2e2)); pil.position.y = 1.3; f.add(pil);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.45, 0.35, 28), wm); bowl.position.y = 2.2; f.add(bowl);
      const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.92, 28), wt); w2.rotation.x = -Math.PI / 2; w2.position.y = 2.39; f.add(w2);
      const top = new THREE.Mesh(GEO.sphere, jellyMaterial(0xff7eb6)); top.scale.set(0.5, 0.42, 0.5); top.position.y = 2.75; f.add(top);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; for (let m = 1; m <= 3; m++) { const d = new THREE.Mesh(GEO.sphereLo, wt); d.scale.setScalar(0.11 - m * 0.015); const r = 0.95 + m * 0.25; d.position.set(Math.cos(a) * r, 2.3 - m * m * 0.16, Math.sin(a) * r); f.add(d); } }
      solids.push({ x: 0, z: 0, r: 2.3 }); }
    // cream paths from the plaza out to every place
    const pathM = mat(0xfff0cf, { roughness: 0.7 }), stoneM = mat(0xffd9a8, { roughness: 0.7 });
    const path = (x, z, stop = 2.2) => { const L = Math.hypot(x, z), len = L - 8.2 - stop; if (len <= 0.5) return; const g = new THREE.Group(); g.position.set(0, Y0 + 0.02, 0); g.rotation.y = Math.atan2(x, z); sc.add(g); const p = new THREE.Mesh(new THREE.PlaneGeometry(2.3, len), pathM); p.rotation.x = -Math.PI / 2; p.position.z = 8.2 + len / 2; g.add(p); for (let k = 0; k < len / 1.3; k++) for (const sx of [-1, 1]) { const st = new THREE.Mesh(GEO.sphereLo, stoneM); st.scale.set(0.22, 0.1, 0.22); st.position.set(sx * 1.3, 0.03, 8.6 + k * 1.3); g.add(st); } };
    const label = (text, x, y, z, w = 4.2) => { const tex = canvasTex(512, 128, (g) => { g.fillStyle = 'rgba(255,255,255,0.96)'; g.beginPath(); g.roundRect ? g.roundRect(6, 14, 500, 100, 50) : g.rect(6, 14, 500, 100); g.fill(); g.lineWidth = 8; g.strokeStyle = '#ff7eb6'; g.stroke(); let fs = 62; g.font = `bold ${fs}px ${FONT}`; while (g.measureText(text).width > 450 && fs > 30) { fs -= 4; g.font = `bold ${fs}px ${FONT}`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#4a2a6a'; g.fillText(text, 256, 68); }); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })); sp.scale.set(w * 1.75, w * 1.75 / 4, 1); sp.position.set(x, y + 0.4, z); sp.userData.y0 = y; sp.renderOrder = 5; sc.add(sp); labels.push(sp); return sp; };
    const toC = (x, z, k) => { const l = Math.hypot(x, z) || 1; return [x - x / l * k, z - z / l * k]; };
    const grp = (x, z, sc0 = 1) => { const g = new THREE.Group(); g.position.set(x, Y0, z); g.rotation.y = Math.atan2(-x, -z); g.scale.setScalar(sc0); sc.add(g); return g; };
    const doorM = mat(0x7a4a8a, { roughness: 0.4 });
    const front = (g, zf, winX = 1.25) => { // door, round windows and a doormat on the +z face
      const door = new THREE.Mesh(GEO.box, doorM); door.scale.set(1.15, 1.75, 0.12); door.position.set(0, 0.88, zf); g.add(door);
      const arch = new THREE.Mesh(GEO.cyl, doorM); arch.scale.set(0.575, 0.12, 0.575); arch.rotation.x = Math.PI / 2; arch.position.set(0, 1.75, zf); g.add(arch);
      const knob = new THREE.Mesh(GEO.sphere, mat(0xffd84d)); knob.scale.setScalar(0.09); knob.position.set(0.36, 0.9, zf + 0.1); g.add(knob);
      for (const sx of [-1, 1]) { const wn = new THREE.Mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: 0xfff3b0 })); wn.scale.set(0.42, 0.1, 0.42); wn.rotation.x = Math.PI / 2; wn.position.set(sx * winX, 1.55, zf - 0.02); g.add(wn); const fr = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 20), mat(0xffffff)); fr.position.set(sx * winX, 1.55, zf + 0.04); g.add(fr); }
      const mt = new THREE.Mesh(GEO.cyl, mat(0xffffff)); mt.scale.set(0.9, 0.05, 0.6); mt.position.set(0, 0.03, zf + 0.7); g.add(mt);
    };
    const bush = (x, z, c = 0x6fd08a, n = 3) => { for (let k = 0; k < n; k++) { const b = new THREE.Mesh(GEO.sphereLo, mat(c, { roughness: 0.9 })); const r = rand(0.45, 0.75); b.scale.set(r, r * 0.8, r); add(b, x + rand(-0.6, 0.6), Y0 + r * 0.45, z + rand(-0.6, 0.6)); } };
    const rb6 = [0xff5a7a, 0xff9a3c, 0xffd23f, 0x4fcf5f, 0x3fb4ff, 0xa86bff];
    const P_CUSTOM = [-15.6, 2.6], P_LEVEL = [15.6, 2.6], P_SHOP = [-12.4, -9.4], P_RANK = [12.4, -9.4], P_NOTES = [-8.4, 10.6], P_DAILY = [8.4, 10.6];
    // 🎨 cupcake house with a paint palette
    { const g = grp(...P_CUSTOM, 1.2);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.0, 2.5, 28), jellyMaterial(0xffd9ec)); body.position.y = 1.25; g.add(body);
      for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283, rib = new THREE.Mesh(GEO.box, mat(0xffb3d6)); rib.scale.set(0.16, 2.3, 0.16); rib.position.set(Math.cos(a) * 2.14, 1.2, Math.sin(a) * 2.14); if (Math.abs(a - Math.PI / 2) > 0.75) g.add(rib); }
      const dome = new THREE.Mesh(GEO.sphere, jellyMaterial(0xff6fae)); dome.scale.set(2.75, 1.75, 2.75); dome.position.y = 2.75; g.add(dome);
      const drip = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.42, 10, 36), jellyMaterial(0xff6fae)); drip.rotation.x = Math.PI / 2; drip.position.y = 2.6; g.add(drip);
      for (let k = 0; k < 22; k++) { const a = rand(0, 6.283), e = rand(0.25, 1.2), s2 = new THREE.Mesh(GEO.sphereLo, mat(rb6[k % 6])); s2.scale.set(0.16, 0.09, 0.16); s2.position.set(Math.cos(a) * Math.cos(e) * 2.75, 2.75 + Math.sin(e) * 1.75, Math.sin(a) * Math.cos(e) * 2.75); g.add(s2); }
      const ch = new THREE.Mesh(GEO.sphere, jellyMaterial(0xff3355)); ch.scale.setScalar(0.48); ch.position.y = 4.75; g.add(ch);
      const stem = new THREE.Mesh(GEO.cyl, mat(0x4fa35f)); stem.scale.set(0.04, 0.6, 0.04); stem.position.set(0.1, 5.3, 0); stem.rotation.z = -0.3; g.add(stem);
      front(g, 2.2, 1.15);
      const ez = new THREE.Group(); ez.position.set(2.9, 0, 1.9); ez.rotation.y = -0.5; g.add(ez); const pal = new THREE.Mesh(GEO.cyl, mat(0xfff1d6)); pal.scale.set(0.8, 0.08, 0.62); pal.rotation.x = Math.PI / 2 - 0.25; pal.position.y = 1.3; ez.add(pal); for (const sx of [-1, 1]) { const lg = new THREE.Mesh(GEO.cyl, mat(0xd9a066)); lg.scale.set(0.05, 1.5, 0.05); lg.position.set(sx * 0.45, 0.72, -0.15); lg.rotation.z = sx * 0.12; ez.add(lg); } rb6.forEach((c, k) => { const d = new THREE.Mesh(GEO.sphereLo, mat(c)); d.scale.setScalar(0.13); const a = k / 6 * 5 - 0.4; d.position.set(Math.cos(a) * 0.5, 1.32 + Math.sin(a) * 0.36, 0.1 + Math.sin(a) * 0.09); ez.add(d); });
    }
    // 🎓 school with a clock tower
    { const g = grp(...P_LEVEL, 1.2);
      const body = new THREE.Mesh(GEO.box, jellyMaterial(0xe4dbff)); body.scale.set(5.2, 2.6, 3.2); body.position.y = 1.3; g.add(body);
      const slab = new THREE.Mesh(GEO.box, jellyMaterial(0x6f8cff)); slab.scale.set(5.6, 0.4, 3.6); slab.position.y = 2.75; g.add(slab);
      const tw = new THREE.Mesh(GEO.box, jellyMaterial(0xe4dbff)); tw.scale.set(1.9, 2.1, 1.9); tw.position.y = 3.95; g.add(tw);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.7, 4), jellyMaterial(0x6f8cff)); cone.rotation.y = Math.PI / 4; cone.position.y = 5.85; g.add(cone);
      const clk = new THREE.Mesh(GEO.cyl, mat(0xffffff)); clk.scale.set(0.62, 0.08, 0.62); clk.rotation.x = Math.PI / 2; clk.position.set(0, 4.05, 0.96); g.add(clk);
      const rimc = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 24), mat(0xffd23f)); rimc.position.set(0, 4.05, 1.0); g.add(rimc);
      const h1 = new THREE.Mesh(GEO.box, doorM); h1.scale.set(0.07, 0.42, 0.04); h1.position.set(0, 4.24, 1.03); g.add(h1); const h2 = new THREE.Mesh(GEO.box, doorM); h2.scale.set(0.3, 0.07, 0.04); h2.position.set(0.14, 4.05, 1.03); g.add(h2);
      const pole = new THREE.Mesh(GEO.cyl, mat(0xffffff)); pole.scale.set(0.05, 1.3, 0.05); pole.position.y = 7.2; g.add(pole); const fl = new THREE.Mesh(GEO.box, mat(0xff5a7a)); fl.scale.set(0.8, 0.48, 0.04); fl.position.set(0.44, 7.55, 0); g.add(fl);
      front(g, 1.62, 1.75);
      for (let k = 0; k < 2; k++) { const st = new THREE.Mesh(GEO.box, mat(0xffffff)); st.scale.set(2.2 - k * 0.5, 0.16, 0.9 - k * 0.35); st.position.set(0, 0.08 + k * 0.16, 2.0 - k * 0.15); g.add(st); }
      for (const sx of [-1, 1]) { const pc = new THREE.Mesh(GEO.cyl, jellyMaterial(sx < 0 ? 0xffd23f : 0x5fe0b0)); pc.scale.set(0.16, 1.5, 0.16); pc.position.set(sx * 3.1, 0.75, 1.9); g.add(pc); const tip = new THREE.Mesh(GEO.cone, mat(0xffe9c9)); tip.scale.set(0.16, 0.36, 0.16); tip.position.set(sx * 3.1, 1.68, 1.9); g.add(tip); }
    }
    // 🛍️ shop booth
    { const booth = grp(...P_SHOP, 1.35);
      const body = new THREE.Mesh(GEO.box, mat(0xfff1d6)); body.scale.set(3.4, 1.5, 2); body.position.y = 0.75; booth.add(body);
      for (let i = 0; i < 6; i++) { const st = new THREE.Mesh(GEO.box, mat(i % 2 ? 0xffffff : 0xff6fae)); st.scale.set(0.62, 0.14, 2.6); st.position.set(-1.55 + i * 0.62, 3.05, 0.25); st.rotation.x = 0.28; booth.add(st); }
      for (const sx of [-1, 1]) { const pl = new THREE.Mesh(GEO.cyl, mat(0xffffff)); pl.scale.set(0.08, 3, 0.08); pl.position.set(sx * 1.6, 1.5, 0.9); booth.add(pl); }
      [0xff7eb6, 0x5cc8ff, 0xffd84d, 0x5fe0b0].forEach((c, i) => { const it = new THREE.Mesh(GEO.sphere, jellyMaterial(c)); it.scale.set(0.3, 0.26, 0.3); it.position.set(-1.1 + i * 0.73, 1.75, 0.4); booth.add(it); });
      const back = new THREE.Mesh(GEO.box, mat(0xffe0ef)); back.scale.set(3.4, 3, 0.2); back.position.set(0, 1.5, -0.95); booth.add(back);
      [[-1, 2.3, 0xa86bff], [0, 2.45, 0xff9a3c], [1, 2.3, 0x4fcf5f]].forEach(([x, y, c]) => { const h = new THREE.Mesh(GEO.cone, jellyMaterial(c)); h.scale.set(0.3, 0.42, 0.3); h.position.set(x, y, -0.75); booth.add(h); });
      for (const [bx, c] of [[-2.5, 0xff9a3c], [2.5, 0x5cc8ff]]) { const cr = new THREE.Mesh(GEO.box, mat(0xe9b97a)); cr.scale.set(0.9, 0.7, 0.9); cr.position.set(bx, 0.35, 0.6); booth.add(cr); for (let k = 0; k < 3; k++) { const o = new THREE.Mesh(GEO.sphereLo, jellyMaterial(c)); o.scale.setScalar(0.24); o.position.set(bx + (k - 1) * 0.26, 0.82, 0.6 + (k % 2) * 0.2); booth.add(o); } }
    }
    // 🏆 winners' steps with gold / silver / bronze crowns and a star arch
    { const win = grp(...P_RANK, 1.35);
      [['gold', 0, 1.5, 0xffd84d], ['silver', -1.5, 1.05, 0xdfe6f0], ['bronze', 1.5, 0.7, 0xe0a070]].forEach(([tier, x, h, c]) => { const st = new THREE.Mesh(GEO.box, jellyMaterial(c)); st.scale.set(1.45, h, 1.5); st.position.set(x, h / 2, 0); win.add(st); const cr = buildCrown(tier); cr.position.set(x, h + 0.25, 0); win.add(cr); cr.userData.spin = true; });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.2, 10, 28, Math.PI), jellyMaterial(0xffd84d)); arc.position.set(0, 0.2, -1.0); win.add(arc);
      for (let k = 0; k < 7; k++) { const a = (k + 0.5) / 7 * Math.PI, s2 = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffffff : 0xfff3b0 })); s2.scale.setScalar(0.17); s2.position.set(Math.cos(a) * 2.7, 0.2 + Math.sin(a) * 2.7, -0.78); win.add(s2); }
      const carpet = new THREE.Mesh(GEO.box, mat(0xff5a7a)); carpet.scale.set(1.5, 0.04, 2.4); carpet.position.set(0, 0.02, 1.9); win.add(carpet);
      this._hubSpin = []; win.traverse((o) => { if (o.userData.spin) this._hubSpin.push(o); });
    }
    const npc = (x, z, look) => { const v = new MallangView(Object.assign({ pattern: 'none', tuft: 'none', scale: 0.62 }, look), true); v.root.position.set(x, Y0, z); v.root.scale.setScalar(1.15); v.yaw.rotation.y = 0; sc.add(v.root); v.hopT = rand(1, 3); v.hy = 0; v.vy0 = 0; v.home = v.root.position.clone(); return v; };
    const npcs = [npc(P_NOTES[0], P_NOTES[1], { colorHex: 0xffa77a, face: 'happy', glasses: 'round', hat: 'cap' }), npc(P_DAILY[0], P_DAILY[1], { colorHex: 0x5cc8ff, face: 'sparkle', hat: 'party' })];
    // 📒 book stack beside the notes teacher, 🎯 notice board beside the mission guide
    { const [x, z] = P_NOTES; [[0xff7eb6, 0], [0x5cc8ff, 0.25], [0xffd84d, -0.2], [0x5fe0b0, 0.1]].forEach(([c, r], k) => { const b = new THREE.Mesh(GEO.box, mat(c)); b.scale.set(1.3, 0.3, 0.95); b.rotation.y = r; add(b, x - 1.9, Y0 + 0.15 + k * 0.3, z - 0.2); const pg = new THREE.Mesh(GEO.box, mat(0xffffff)); pg.scale.set(1.22, 0.2, 0.9); pg.rotation.y = r; add(pg, x - 1.86, Y0 + 0.15 + k * 0.3, z - 0.16); }); const pn = new THREE.Mesh(GEO.cyl, jellyMaterial(0xffd23f)); pn.scale.set(0.13, 1.5, 0.13); pn.rotation.z = 0.35; add(pn, x - 2.9, Y0 + 0.75, z + 0.2); solids.push({ x: x - 1.9, z: z - 0.2, r: 0.8 }); }
    { const [x, z] = P_DAILY; for (const sx of [-1, 1]) { const lg = new THREE.Mesh(GEO.cyl, mat(0xd9a066)); lg.scale.set(0.08, 2.4, 0.08); add(lg, x + 2.1 + sx * 0.85, Y0 + 1.2, z - 0.2); } const bd = new THREE.Mesh(GEO.box, mat(0xfff1d6)); bd.scale.set(2.2, 1.5, 0.14); add(bd, x + 2.1, Y0 + 1.9, z - 0.2); const tg = canvasTex(256, 176, (g) => { g.fillStyle = '#fff8e6'; g.fillRect(0, 0, 256, 176); g.font = '110px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🎯', 128, 96); }); const pl = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.36), new THREE.MeshBasicMaterial({ map: tg })); add(pl, x + 2.1, Y0 + 1.9, z - 0.12); solids.push({ x: x + 2.1, z: z - 0.2, r: 0.9 }); }
    const spot = (id, x, z, r, sx, sz, sr) => { spots.push({ id, x, z, r, in: false }); if (sr) solids.push({ x: sx, z: sz, r: sr }); };
    spot('map', 0, -15.0, 2.2);
    { const [x, z] = P_CUSTOM, [dx, dz] = toC(x, z, 3.9); spot('custom', dx, dz, 1.9, x, z, 3.3); label('🎨 꾸미기 집', x, Y0 + 7.4, z); path(x, z, 3.2); bush(x + 1.5, z - 4.2); bush(x + 1.2, z + 4.3, 0x8fe0a0); }
    { const [x, z] = P_LEVEL, [dx, dz] = toC(x, z, 4.0); spot('level', dx, dz, 1.9, x, z, 3.5); label('🎓 승급 학교', x, Y0 + 9.6, z); path(x, z, 3.2); bush(x - 1.5, z - 4.6); bush(x - 1.2, z + 4.7, 0x8fe0a0); }
    { const [x, z] = P_SHOP, [dx, dz] = toC(x, z, 3.3); spot('shop', dx, dz, 1.9, x, z, 2.8); label('🛍️ 상점', x, Y0 + 5.9, z, 4); path(x, z, 2.6); }
    { const [x, z] = P_RANK, [dx, dz] = toC(x, z, 3.5); spot('rank', dx, dz, 1.9, x, z, 3.0); label('🏆 랭킹', x, Y0 + 5.8, z, 4); path(x, z, 2.6); }
    { const [x, z] = P_NOTES; spot('notes', x, z, 1.9, x, z, 0.9); label('📒 오답노트', x, Y0 + 2.9, z, 3.6); path(x, z, 1.2); }
    { const [x, z] = P_DAILY; spot('daily', x, z, 1.9, x, z, 0.9); label('🎯 오늘의 미션', x, Y0 + 2.9, z, 3.8); path(x, z, 1.2); }
    // benches and flower beds around the plaza
    for (const a of [72, 108, 250, 290].map((d) => d * Math.PI / 180)) { const x = Math.cos(a) * 11, z = Math.sin(a) * 11, g = new THREE.Group(); g.position.set(x, Y0, z); g.rotation.y = Math.atan2(-x, -z); sc.add(g); const seat = new THREE.Mesh(GEO.box, jellyMaterial(0xffc27a)); seat.scale.set(1.9, 0.16, 0.6); seat.position.y = 0.5; g.add(seat); const bk = new THREE.Mesh(GEO.box, jellyMaterial(0xffc27a)); bk.scale.set(1.9, 0.5, 0.12); bk.position.set(0, 0.95, -0.28); g.add(bk); for (const sx of [-1, 1]) { const lg = new THREE.Mesh(GEO.box, mat(0xffffff)); lg.scale.set(0.12, 0.5, 0.5); lg.position.set(sx * 0.8, 0.25, 0); g.add(lg); } solids.push({ x, z, r: 0.95 }); }
    [90, 35, 145, 190, 350, 235, 305].forEach((dg, i) => { const a = dg * Math.PI / 180, x = Math.cos(a) * 9.6, z = Math.sin(a) * 9.6; const bed = new THREE.Mesh(GEO.cyl, mat(0x9b6a4a, { roughness: 1 })); bed.scale.set(0.85, 0.16, 0.85); add(bed, x, Y0 + 0.08, z); for (let k = 0; k < 7; k++) { const fa = k / 7 * 6.283, fl = new THREE.Mesh(GEO.sphereLo, mat(rb6[(i + k) % 6])); fl.scale.set(0.2, 0.2, 0.2); add(fl, x + Math.cos(fa) * 0.5, Y0 + 0.32, z + Math.sin(fa) * 0.5); } const mid = new THREE.Mesh(GEO.sphereLo, mat(0xffffff)); mid.scale.setScalar(0.24); add(mid, x, Y0 + 0.38, z); });
    // little pond with a duck at the front of the island
    { const px = 0, pz = 15.2; const rimP = add(new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.34, 10, 36), jellyMaterial(0xfff6fb)), px, Y0 + 0.1, pz); rimP.rotation.x = Math.PI / 2; const wtr = add(new THREE.Mesh(new THREE.CircleGeometry(2.9, 36), new THREE.MeshBasicMaterial({ color: 0x8fdcff })), px, Y0 + 0.06, pz); wtr.rotation.x = -Math.PI / 2;
      [[-1.3, 0.7], [1.2, -0.9], [0.4, 1.5]].forEach(([lx, lz], k) => { const pad = new THREE.Mesh(GEO.cyl, mat(0x5fcf7a)); pad.scale.set(0.5, 0.04, 0.5); add(pad, px + lx, Y0 + 0.1, pz + lz); if (k !== 1) { const fl = new THREE.Mesh(GEO.sphereLo, mat(0xff9ccf)); fl.scale.setScalar(0.17); add(fl, px + lx, Y0 + 0.22, pz + lz); } });
      const dk = new THREE.Group(); const db = new THREE.Mesh(GEO.sphere, jellyMaterial(0xffe14d)); db.scale.set(0.5, 0.36, 0.42); dk.add(db); const dh = new THREE.Mesh(GEO.sphere, jellyMaterial(0xffe14d)); dh.scale.setScalar(0.26); dh.position.set(0.36, 0.38, 0); dk.add(dh); const bk = new THREE.Mesh(GEO.cone, mat(0xff9a3c)); bk.scale.set(0.09, 0.2, 0.09); bk.rotation.z = -Math.PI / 2; bk.position.set(0.62, 0.36, 0); dk.add(bk); add(dk, px - 0.3, Y0 + 0.22, pz - 0.5); this._hubDuck = dk; dk.userData = { cx: px, cz: pz };
      solids.push({ x: px, z: pz, r: 3.0 }); }
    // picket fence around the rim (open behind the rainbow gate)
    { const fm = mat(0xffffff, { roughness: 0.6 }), FR = IR - 1.1; for (let i = 0; i < 84; i++) { const a = i / 84 * Math.PI * 2; if (Math.abs(a - Math.PI * 1.5) < 0.2) continue; const p = new THREE.Mesh(GEO.box, fm); p.scale.set(0.16, 0.85, 0.16); p.rotation.y = -a; add(p, Math.cos(a) * FR, Y0 + 0.42, Math.sin(a) * FR); const cap = new THREE.Mesh(GEO.sphereLo, jellyMaterial(rb6[i % 6])); cap.scale.setScalar(0.14); add(cap, Math.cos(a) * FR, Y0 + 0.92, Math.sin(a) * FR); } const rail = add(new THREE.Mesh(new THREE.TorusGeometry(FR, 0.06, 6, 96), fm), 0, Y0 + 0.55, 0); rail.rotation.x = Math.PI / 2; }
    // trees, flowers, balloons
    const deco = Course.prototype.decoItem;
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + rand(-0.08, 0.08); const tr = rand(16.6, 18.8), tx = Math.cos(a) * tr, tz = Math.sin(a) * tr; if ((tz < 0 && Math.abs(tx) < 6.5) || (tz > 9 && Math.abs(tx) < 12) || solids.some((q) => Math.hypot(q.x - tx, q.z - tz) < q.r + 2.6)) continue; solids.push({ x: tx, z: tz, r: 0.5 }); const o = deco.call({}, i % 3 === 2 ? 'jungle' : 'candy'); o.scale.setScalar(0.62); add(o, tx, Y0, tz); o.rotation.y = rand(0, 6); }
    const flM = [0xff7eb6, 0xffd84d, 0xffffff, 0xa77bff, 0x7fe7ff].map((c) => mat(c));
    for (let i = 0; i < 130; i++) { const a = rand(0, 6.283), r = rand(9.2, 19.4), f = new THREE.Mesh(GEO.sphereLo, flM[i % 5]); f.scale.set(0.14, 0.09, 0.14); add(f, Math.cos(a) * r, Y0 + 0.08, Math.sin(a) * r); }
    const balloons = [];
    for (let i = 0; i < 12; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(GEO.sphere, jellyMaterial(rb[i % 6])); b.scale.set(0.55, 0.68, 0.55); g.add(b); const st = new THREE.Mesh(GEO.cyl, mat(0xffffff)); st.scale.set(0.015, 2.2, 0.015); st.position.y = -1.75; g.add(st); const a = rand(0, 6.283), r = rand(12, 21); g.position.set(Math.cos(a) * r, rand(8.5, 13), -Math.abs(Math.sin(a) * r) - 1); g.userData = { y0: g.position.y, ph: rand(0, 6) }; sc.add(g); balloons.push(g); }
    // the six worlds float in the distance
    const isles = [];
    WORLD_ORDER.forEach((w, i) => {
      const th = WORLDS[w], g = new THREE.Group(), a = -1.15 + i * 0.46, R = 52 + (i % 2) * 14;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(7, 6.4, 1.2, 28), mat(new THREE.Color(th.floorA).getHex(), { roughness: 0.8 })); g.add(top);
      const und = new THREE.Mesh(new THREE.CylinderGeometry(6.3, 0.8, 7, 20), mat(th.side, { roughness: 0.8 })); und.position.y = -4.1; g.add(und);
      for (let k = 0; k < 4; k++) { const o = deco.call({}, w); o.scale.setScalar(0.75); o.position.set(rand(-3.6, 3.6), 0.6, rand(-3.6, 3.6)); if (w === 'cloud' || w === 'space') o.position.y = 1.5; g.add(o); }
      g.position.set(Math.sin(a) * R, 3 + (i % 3) * 5, -Math.cos(a) * R); g.userData = { y0: g.position.y, ph: i * 1.3 }; sc.add(g); isles.push(g);
    });
    // sea of clouds
    const cloudM = mat(0xffffff, { roughness: 1, emissive: 0x777788 });
    for (let i = 0; i < 46; i++) { const c = new THREE.Group(), s = rand(3, 8); for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(GEO.sphereLo, cloudM); b.scale.setScalar(s * rand(0.6, 1.1)); b.position.set((k - 2) * s * 0.8, rand(0, s * 0.4), rand(-s * 0.3, s * 0.3)); c.add(b); } const a = rand(0, 6.283), r = i < 34 ? rand(26, 120) : rand(80, 135); c.position.set(Math.cos(a) * r, i < 34 ? rand(-22, -11) : rand(16, 40), Math.sin(a) * r - 20); c.userData.sp = rand(0.15, 0.5); sc.add(c); (this._hubClouds = this._hubClouds || []).push(c); }
    // sparkles
    const SN = 150, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { const a = rand(0, 6.283), r = rand(1, 20); sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = rand(0, 9); sp[i * 3 + 2] = Math.sin(a) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const spTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,245,190,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ map: spTex, size: 0.32, transparent: true, depthWrite: false, opacity: 0.9 })); sparks.frustumCulled = false; sc.add(sparks);
    sc.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent && !o.material.isMeshBasicMaterial && !o.material.isShaderMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    // characters
    const player = new MallangView(playerLookSafe(), true); player.root.scale.setScalar(1.0); sc.add(player.root);
    const friends = [], csKeys = Object.keys(COSTUMES).filter((k) => k !== 'none');
    for (let i = 0; i < 12; i++) {
      const look = { colorHex: AI_COLORS[(i * 3 + 1) % AI_COLORS.length], face: pick(['happy', 'wink', 'normal', 'sparkle', 'sleepy']), tuft: pick(TUFTS), pattern: i % 4 === 0 ? pick(['dots', 'stripes', 'stars']) : 'none', hat: i % 5 === 1 ? pick(['beanie', 'party', 'flower', 'cap']) : 'none', scale: 0.62 };
      if (i % 3 === 0) { const k = csKeys[(i * 5 + 2) % csKeys.length]; look.costume = k; if (COSTUMES[k].color) look.colorHex = COSTUMES[k].color; }
      const f = new MallangView(look, true); f.root.scale.setScalar(rand(0.72, 0.9)); f.ang = i / 12 * Math.PI * 2 + rand(-0.2, 0.2); f.rad = rand(3.6, 9.6);
      f.pos = new THREE.Vector3(Math.cos(f.ang) * f.rad, Y0, Math.sin(f.ang) * f.rad); f.tgt = f.pos.clone(); f.waitT = rand(0, 3); f.spd = rand(1.3, 2.4); f.hopT = rand(1, 5); f.hy = 0; f.vy0 = 0; f.root.position.copy(f.pos); sc.add(f.root); friends.push(f);
    }
    this.hub = { scene: sc, camera: cam, player, friends, t: 0, zoom: 0, px: 0, glow, swirl, balloons, isles, sparks, Y0, sun, spots, solids, labels, npcs, pp: new THREE.Vector3(0, Y0, 4), pv: new THREE.Vector3(), camLook: new THREE.Vector3(0, 0, 0) };
    this.placeHubCamera();
    addEventListener('pointermove', (e) => { if (this.hub) this.hub.pxT = Stage.x(e) / Stage.w * 2 - 1; });
    $('#gl').addEventListener('pointerdown', (e) => {
      if (this.race || this.screen !== 'hub') return;
      const ndc = new THREE.Vector2(Stage.x(e) / Stage.w * 2 - 1, -(Stage.y(e) / Stage.h) * 2 + 1); const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, cam);
      if (rc.intersectObject(player.root, true).length) { player.vy0 = 7; player.stretch(0.4); player.setFace(pick(['joy', 'happy', 'heart', 'surprise']), 1.2); Sound.play('boing'); return; }
      for (const f of friends) if (rc.intersectObject(f.root, true).length) { f.vy0 = 6.5; f.stretch(0.4); f.setFace(pick(['joy', 'surprise', 'heart']), 1.2); Sound.play('boing'); break; }
    });
  },
  placeHubCamera() { const H = this.hub; if (!H.camInit) { H.camera.position.set(H.pp.x, 5, H.pp.z + 10); H.camInit = true; } },
  hubAction(id) {
    const H = this.hub; H.pv.set(0, 0, 0); Sound.play('click');
    if (id === 'daily') this.menuDaily(); else this.openMenu(id);
  },
  updateHub(dt) {
    const H = this.hub; H.t += dt; const t = H.t, P = H.player, pp = H.pp, pv = H.pv, port = this.aspect < 0.9;
    const active = this.screen === 'hub' && $('#modal').classList.contains('hidden') && !!Save.data.profile;
    // walk around the plaza
    const inp = active ? Input.read() : { x: 0, z: 0, jump: false };
    const SPD = 6.4, k = Math.min(1, dt * 9); pv.x += (inp.x * SPD - pv.x) * k; pv.z += (inp.z * SPD - pv.z) * k;
    pp.x += pv.x * dt; pp.z += pv.z * dt;
    const pr = Math.hypot(pp.x, pp.z); if (pr > 19.2) { pp.x *= 19.2 / pr; pp.z *= 19.2 / pr; }
    for (const q of H.solids) { const dx = pp.x - q.x, dz = pp.z - q.z, d = Math.hypot(dx, dz), m = q.r + 0.55; if (d < m && d > 0.001) { pp.x = q.x + dx / d * m; pp.z = q.z + dz / d * m; } }
    if (inp.jump && (P.hy || 0) <= 0) { P.vy0 = 8.5; P.stretch(0.38); Sound.play('jump'); }
    P.hy = (P.hy || 0) + (P.vy0 || 0) * dt; P.vy0 = (P.vy0 || 0) - 25 * dt; if (P.hy <= 0) { if ((P.vy0 || 0) < -3) P.land(0.4); P.hy = 0; P.vy0 = 0; }
    const sp = Math.hypot(pv.x, pv.z), moving = sp > 0.6;
    let ty = H.zoom ? 0 : (moving ? Math.atan2(pv.x, pv.z) : P.yaw.rotation.y); let dy = ty - P.yaw.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; P.yaw.rotation.y += dy * Math.min(1, dt * 10);
    P.root.position.set(pp.x, H.Y0 + P.hy, pp.z); P.update(dt, clamp(sp / SPD, 0, 1), P.hy <= 0, moving);
    H.glow.position.set(pp.x, H.Y0 + 0.04, pp.z);
    if (active) for (const s of H.spots) { const inside = Math.hypot(pp.x - s.x, pp.z - s.z) < s.r; if (inside && !s.in) { s.in = true; this.hubAction(s.id); break; } if (!inside) s.in = false; }
    for (const f of H.friends) {
      const dx = f.tgt.x - f.pos.x, dz = f.tgt.z - f.pos.z, dl = Math.hypot(dx, dz); let mv = false;
      if (dl > 0.15) { const st = Math.min(dl, f.spd * dt); f.pos.x += dx / dl * st; f.pos.z += dz / dl * st; mv = true; const yy = Math.atan2(dx, dz); let d2 = yy - f.yaw.rotation.y; while (d2 > Math.PI) d2 -= Math.PI * 2; while (d2 < -Math.PI) d2 += Math.PI * 2; f.yaw.rotation.y += d2 * Math.min(1, dt * 6); }
      else { f.waitT -= dt; if (f.waitT <= 0) { f.waitT = rand(1, 4.5); f.ang += (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 1.1); f.rad = rand(3.6, 9.6); f.tgt.set(Math.cos(f.ang) * f.rad, H.Y0, Math.sin(f.ang) * f.rad); } }
      const ddx = f.pos.x - pp.x, ddz = f.pos.z - pp.z, dd = Math.hypot(ddx, ddz); if (dd < 1.3 && dd > 0.01) { f.pos.x += ddx / dd * (1.3 - dd); f.pos.z += ddz / dd * (1.3 - dd); if (f.hy <= 0 && sp > 2) { f.vy0 = 5; f.setFace('surprise', 0.8); } }
      f.hopT -= dt; if (f.hopT <= 0 && f.hy <= 0) { f.hopT = rand(1.5, 5); f.vy0 = rand(4.5, 7); f.stretch(0.3); }
      f.hy += f.vy0 * dt; f.vy0 -= 25 * dt; if (f.hy <= 0) { if (f.vy0 < -3) f.land(0.3); f.hy = 0; f.vy0 = 0; }
      f.root.position.set(f.pos.x, H.Y0 + f.hy, f.pos.z); f.update(dt, mv ? 0.5 : 0, f.hy <= 0, mv);
    }
    for (const n of H.npcs) { n.hopT -= dt; if (n.hopT <= 0 && n.hy <= 0) { n.hopT = rand(1.2, 3); n.vy0 = 5.5; n.stretch(0.3); } n.hy += n.vy0 * dt; n.vy0 -= 25 * dt; if (n.hy <= 0) { if (n.vy0 < -3) n.land(0.3); n.hy = 0; n.vy0 = 0; } n.root.position.y = n.home.y + n.hy; n.update(dt, 0, n.hy <= 0, false); }
    H.labels.forEach((l, i) => { l.position.y = l.userData.y0 + Math.sin(t * 2 + i) * 0.12; });
    H.glow.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06); H.glow.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.2;
    H.swirl.material.map.center.set(0.5, 0.5); H.swirl.material.map.rotation = t * 0.7;
    for (const b of H.balloons) { b.position.y = b.userData.y0 + Math.sin(t * 0.8 + b.userData.ph) * 0.35; b.rotation.z = Math.sin(t * 0.6 + b.userData.ph) * 0.08; }
    for (const g of H.isles) { g.position.y = g.userData.y0 + Math.sin(t * 0.4 + g.userData.ph) * 0.9; g.rotation.y += dt * 0.05; }
    for (const c of this._hubClouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 130) c.position.x = -130; }
    for (const o of this._hubSpin) o.rotation.y += dt * 0.8;
    { const dk = this._hubDuck; if (dk) { const a = t * 0.5; dk.position.x = dk.userData.cx + Math.cos(a) * 1.3; dk.position.z = dk.userData.cz + Math.sin(a) * 1.0; dk.rotation.y = -a - Math.PI / 2; } }
    const pa = H.sparks.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { let y = pa.getY(i) + dt * (0.25 + (i % 5) * 0.08); if (y > 9) y = 0; pa.setY(i, y); } pa.needsUpdate = true;
    // follow camera (closer, front-on while customising)
    const zv = !H.zoom; if (zv !== H._vis) { H._vis = zv; for (const f of H.friends) f.root.visible = zv; for (const n of H.npcs) n.root.visible = zv; for (const l of H.labels) l.visible = zv; }
    if (H.zoom) { _tv.set(pp.x, H.Y0 + (port ? 3.4 : 2.6), pp.z + (port ? 11.5 : 8)); _tv2.set(pp.x, H.Y0 + (port ? -2.2 : -1.9), pp.z); }
    else { const fk = 0.55; _tv.set(pp.x * fk, H.Y0 + 21.5, pp.z * fk + 23.5); _tv2.set(pp.x * fk, H.Y0, pp.z * fk - 2.2); }
    const ck = 1 - Math.exp(-5 * dt); H.camera.position.lerp(_tv, ck); H.camLook.lerp(_tv2, ck); H.camera.lookAt(H.camLook);
    if (this.renderer.shadowMap.enabled) { H.sun.target.position.set(0, 0, 0); }
  },
  // ---------------- fever mode (bonus race without gates, one ticket per 5 normal races) ----------------
  drawFever() {
    const S = Save.data, on = !!S.profile && !this.race && (this.screen === 'hub' || this.screen === 'map'), tk = S.runTickets || 0, f = $('#fever'), m = $('#fever-mini');
    f.classList.toggle('hidden', !(on && tk > 0)); m.classList.toggle('hidden', !(on && tk < 1 && this.screen === 'map'));
    $('#hub-hint').style.visibility = on && tk > 0 && this.screen === 'hub' ? 'hidden' : '';
    if (on && tk > 0) { f.innerHTML = `<span class="fv-ic">🔥</span><span class="fv-t"><b>피버 모드 열렸어요!</b><small>문제 없이 달리기 · 에너지 2배 · 참가권 ${tk}장</small></span><span class="fv-go">참가 ▶</span>`; f.onclick = () => { Sound.play('click'); this.feverModal(); }; }
    if (on && tk < 1) { const p = S.runProgress || 0; m.innerHTML = `🔥 피버 모드까지 ${Array.from({ length: RUN_NEED }, (_, i) => `<i class="${i < p ? 'on' : ''}"></i>`).join('')} ${p}/${RUN_NEED}판`; }
  },
  feverModal() {
    const S = Save.data; S.feverSeen = true; Save.save(); const tk = S.runTickets || 0;
    this.modal(`<div class="fever-hero"><div class="big">🔥 피버 모드!</div><p>문제 없이 장애물만 신나게 달리는 보너스 레이스예요.<br>완주하면 숫자 에너지를 <b>2배</b>로 받아요.</p></div>
      <p style="text-align:center;font-size:17px;margin:12px 0 4px">🎟️ 참가권 <b>${tk}장</b> · 일반 레이스 ${RUN_NEED}판을 완주할 때마다 1장</p>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn fever" id="fv-go">🔥 지금 참가하기</button><button class="btn gray" id="fv-no">나중에</button></div>`);
    $('#fv-go').onclick = () => this.startFever(); $('#fv-no').onclick = () => { this.closeModal(); this.drawFever(); };
  },
  startFever() {
    const S = Save.data; if (!(S.runTickets > 0)) return; if (this.race) { this.race.dispose(); this.race = null; }
    const ws = S.unlockedWorlds.filter((w) => WORLDS[w]); this.paused = false; this.startRace(pick(ws.length ? ws : ['candy']), 50, 'run');
  },
  // ---------------- hub UI ----------------
  drawHub() {
    const S = Save.data, P = S.profile, al = accountLevel(S.xp), L = LEVELS[P.level], col = playerColorCss();
    const crown = S.lastCrown ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[S.lastCrown] : '';
    $('#hub-top').innerHTML = `<div class="pcard"><span class="blob" style="--c:${col}"></span><div class="pc-t"><b>${escapeHtml(P.nick)} ${crown}</b><span class="pc-lv">말랑 Lv.${al.lv}<span class="xpbar"><i style="width:${al.cur / al.need * 100}%"></i></span></span></div></div>
      <div></div>
      <div class="pills">${Online.enabled ? '<button class="pill rooms" id="hub-rooms">👫 친구 방</button>' : ''}${Number.isFinite(Online.timeLeft()) ? `<div class="pill">⏰ ${Math.max(0, Math.ceil(Online.timeLeft() / 60))}분</div>` : ''}<div class="pill hidden" id="hub-cloud"></div><div class="pill">${L.icon} ${P.level}학년 ${L.name}</div><div class="pill en">⚡ <b>${S.energy}</b></div><button class="pill gear" id="hub-gear">⚙️</button></div>`;
    $('#hub-gear').onclick = () => { Sound.play('click'); this.menuSettings(); };
    if ($('#hub-rooms')) $('#hub-rooms').onclick = () => { Sound.play('click'); this.menuRooms(); };
    this.drawCloud();
    const claimable = DAILY.some((m) => (S.daily.progress[m.id] || 0) >= m.goal && !S.daily.claimed[m.id]);
    this.drawFever();
    $('#hub-hint').innerHTML = claimable ? '🎯 미션 보상이 기다려요! 파란 말랑이에게 가 보세요' : `🏁 무지개 문으로 들어가면 레이스 · 🔥 피버 모드까지 ${S.runProgress || 0}/${RUN_NEED}판`;
  },
  enterHub() {
    this.show('hub'); this.setHubZoom(0); this.closeModal(); $('#controls').classList.remove('hidden');
    const H = this.hub; if (Math.hypot(H.pp.x, H.pp.z + 15) < 3.4) { H.pp.set(0, H.Y0, -10.5); H.pv.set(0, 0, 0); }
    this.checkDaily(); this.drawHub(); Sound.startMusic(MUSIC.hub);
    { const S = Save.data; if (S.profile && S.runTickets > 0 && !S.feverSeen && $('#modal').classList.contains('hidden')) this.feverModal(); }
  },
  menuDaily() {
    const S = Save.data;
    const missions = DAILY.map((m) => { const p = Math.min(m.goal, S.daily.progress[m.id] || 0), done = p >= m.goal, cl = S.daily.claimed[m.id]; return `<div class="mission big"><span class="ml">${m.label}</span><span class="bar"><i style="width:${p / m.goal * 100}%"></i></span>${cl ? '<span>✅ 받음</span>' : done ? `<button class="btn sm green" data-claim="${m.id}">+${m.reward} ⚡ 받기</button>` : `<span class="muted">${p}/${m.goal} · +${m.reward} ⚡</span>`}</div>`; }).join('');
    this.modal(`<h2>🎯 오늘의 미션</h2><p class="muted">미션 말랑이: "오늘도 신나게 달려 볼까?"</p>${missions}<p class="muted" style="margin-top:10px">출석 ${S.attendance.streak}일 연속 🔥 · 총 ${S.attendance.days}일</p>`);
    $$('[data-claim]').forEach((b) => (b.onclick = () => { const m = DAILY.find((x) => x.id === b.dataset.claim); S.daily.claimed[m.id] = true; S.energy += m.reward; S.energyEarned += m.reward; Save.save(); Sound.play('coin'); this.menuDaily(); }));
  },
  // ---------------- world map ----------------
  menuRace(sel) { this.showMap(sel); },
  menuMap() { this.showMap(); },
  showMap(sel) {
    const S = Save.data; S.worldBest = S.worldBest || {}; this.closeModal();
    this.mapSel = sel || this.mapSel || this._lastWorld || 'candy';
    this.show('map'); $('#controls').classList.add('hidden'); this.drawMap();
    if (!this._mapBound) { this._mapBound = true; addEventListener('resize', () => { if (this.screen === 'map') this.drawMap(); }); }
  },
  drawMap() {
    const S = Save.data, port = false, VW = port ? 700 : 1280, VH = port ? 1180 : 720;
    const pos = port ? [[180, 1000], [520, 860], [190, 690], [515, 520], [195, 350], [500, 185]] : [[480, 545], [600, 275], [790, 525], [915, 285], [1105, 490], [1150, 150]];
    const sel = this.mapSel, si = WORLD_ORDER.indexOf(sel);
    // smooth route through the islands
    let d = `M${pos[0][0]},${pos[0][1] + 30}`;
    for (let i = 0; i < pos.length - 1; i++) { const p0 = pos[Math.max(0, i - 1)], p1 = pos[i], p2 = pos[i + 1], p3 = pos[Math.min(pos.length - 1, i + 2)]; d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + 30 + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] + 30 - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1] + 30}`; }
    const rnd = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
    let waves = ''; for (let i = 0; i < 46; i++) { const x = rnd(i) * VW, y = rnd(i + 99) * VH; waves += `<path d="M${x},${y} q10,-9 20,0 t20,0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="${0.25 + rnd(i + 7) * 0.3}"/>`; }
    const extras = port ? [['⛵', 560, 1080, 44], ['🐳', 90, 520, 44], ['🏝️', 600, 690, 40], ['🐙', 80, 150, 38]] : [['⛵', 250, 330, 46], ['🐳', 800, 100, 46], ['🏝️', 950, 660, 40], ['🐙', 380, 130, 38], ['⛵', 120, 180, 36]];
    const isl = WORLD_ORDER.map((w, i) => {
      const W = WORLDS[w], A = MAP_ART[w], [x, y] = pos[i], un = S.unlockedWorlds.includes(w), best = S.worldBest[w];
      const stars = best ? (best.rank === 1 ? 3 : best.rank <= 3 ? 2 : 1) : 0;
      return `<g class="isl ${un ? '' : 'locked'} ${w === sel ? 'sel' : ''}" data-w="${w}" transform="translate(${x},${y})">
        <ellipse cx="0" cy="52" rx="128" ry="30" fill="#1f6fb8" opacity=".22"/>
        <g class="bob" style="animation-delay:${-i * 0.7}s">
          ${w === sel ? '<ellipse cx="0" cy="24" rx="132" ry="60" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="14 12" class="selring"/>' : ''}
          <ellipse cx="0" cy="36" rx="116" ry="44" fill="#e9cf98"/><ellipse cx="0" cy="30" rx="116" ry="44" fill="#fbe9bd"/>
          <ellipse cx="0" cy="20" rx="102" ry="38" fill="url(#mg-${w})"/><ellipse cx="-18" cy="10" rx="62" ry="18" fill="#fff" opacity=".28"/>
          <g class="deco">${A.deco.map(([e, dx, dy, fs]) => `<text x="${dx}" y="${dy + fs * 0.35}" font-size="${fs}" text-anchor="middle">${e}</text>`).join('')}</g>
          ${un ? '' : `<g><circle cx="0" cy="6" r="30" fill="#fff" opacity=".95"/><text x="0" y="18" font-size="34" text-anchor="middle">🔒</text></g>`}
          <g class="num"><circle cx="-92" cy="-28" r="22" fill="${un ? '#ff5fa2' : '#a79fc0'}" stroke="#fff" stroke-width="5"/><text x="-92" y="-18" font-size="28" text-anchor="middle" fill="#fff">${i + 1}</text></g>
        </g>
        <g class="tag"><rect x="-96" y="78" width="192" height="40" rx="20" fill="#fff" stroke="${w === sel ? '#ff5fa2' : '#ffffff'}" stroke-width="4"/><text x="0" y="106" font-size="23" text-anchor="middle" fill="#3d2a55">${W.name}${un ? '' : ` · ⚡${W.price}`}</text></g>
        ${stars ? `<text x="0" y="142" font-size="22" text-anchor="middle">${'⭐'.repeat(stars)}</text>` : ''}
      </g>`;
    }).join('');
    const [mx, my] = pos[si];
    $('#map-svg').innerHTML = `<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>${WORLD_ORDER.map((w) => `<linearGradient id="mg-${w}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MAP_ART[w].c[0]}"/><stop offset="1" stop-color="${MAP_ART[w].c[1]}"/></linearGradient>`).join('')}</defs>
      ${waves}
      ${extras.map(([e, x, y, fs]) => `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" class="drift">${e}</text>`).join('')}
      <path d="${d}" fill="none" stroke="#1f6fb8" stroke-opacity=".25" stroke-width="22" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-dasharray="4 24"/>
      ${isl}
      <g transform="translate(${mx},${my - 86})"><g class="mapme">${blobSvg(playerColorCss(), 0.95)}<path d="M-10,34 L0,48 L10,34Z" fill="#fff"/></g></g>
      <g transform="translate(${port ? VW - 80 : 90},${port ? 78 : 90})" opacity=".9"><circle r="46" fill="#fff" opacity=".85"/><path d="M0,-38 L9,0 L0,38 L-9,0Z" fill="#ff5fa2"/><path d="M-38,0 L0,-9 L38,0 L0,9Z" fill="#7a63a0" opacity=".6"/><text y="-48" font-size="20" text-anchor="middle" fill="#fff">N</text></g>
      <g class="mcloud" style="animation-duration:38s"><ellipse cx="0" cy="${VH * 0.22}" rx="80" ry="26" fill="#fff" opacity=".7"/><ellipse cx="50" cy="${VH * 0.22 - 16}" rx="50" ry="24" fill="#fff" opacity=".7"/></g>
      <g class="mcloud" style="animation-duration:55s;animation-delay:-20s"><ellipse cx="0" cy="${VH * 0.7}" rx="100" ry="30" fill="#fff" opacity=".6"/><ellipse cx="-50" cy="${VH * 0.7 - 18}" rx="60" ry="26" fill="#fff" opacity=".6"/></g>
    </svg>`;
    $('#map-energy').innerHTML = `⚡ <b>${S.energy}</b>`;
    $$('#map-svg .isl').forEach((g) => (g.onclick = () => { if (this.mapSel !== g.dataset.w) { this.mapSel = g.dataset.w; Sound.play('click'); this.drawMap(); } }));
    // info sheet
    const W = WORLDS[sel], un = S.unlockedWorlds.includes(sel), best = S.worldBest[sel], P = S.profile, can = S.energy >= W.price, subj = SUBJECTS[S.settings.subject] && S.settings.subject !== 'run' ? S.settings.subject : 'math';
    $('#map-sheet').innerHTML = `<div class="ms-head"><span class="ms-ic" style="background:linear-gradient(180deg,${MAP_ART[sel].c.join(',')})">${W.icon}</span><div class="ms-t"><b>${si + 1}. ${W.name}</b><small>${WORLD_FEAT[sel]}</small></div></div>
      <div class="ms-chips"><span>📚 추천 ${W.grade}학년 · ${W.topic}</span><span>🏅 ${best ? `최고 ${best.rank}등` : '아직 기록 없음'}</span></div>
      <div class="ms-sub">${Object.keys(SUBJECTS).filter((k) => k !== 'run').map((k) => `<button class="sj ${k === subj ? 'on' : ''}" data-sj="${k}"><b>${SUBJECTS[k].icon} ${SUBJECTS[k].name}</b></button>`).join('')}</div><div class="ms-note">${SUBJECTS[subj].desc}${subj === 'math' ? ` (${P.level}학년 수준)` : ''}</div>
      ${un ? `<button class="btn" id="map-go">🏁 여기서 레이스!</button>` : `<button class="btn yellow" id="map-unlock" ${can ? '' : 'disabled'}>🔓 ⚡${W.price}로 열기</button>${can ? '' : `<div class="ms-note">숫자 에너지가 ${W.price - S.energy}개 더 필요해요</div>`}`}
      <div class="ms-note">나 + AI 말랑이 49명 · 온라인 대전은 아직 준비 중이에요</div>`;
    if (un) $('#map-go').onclick = () => { this._lastWorld = sel; Sound.play('click'); this.startRace(sel, 50, subj); };
    else $('#map-unlock').onclick = () => this.unlockWorld(sel, () => this.drawMap());
    $$('#map-sheet .sj').forEach((b) => (b.onclick = () => { S.settings.subject = b.dataset.sj; Save.save(); Sound.play('click'); this.drawMap(); }));
    $('#map-back').onclick = () => { Sound.play('click'); this.enterHub(); };
  },
  // ---------------- register (with starter colour) ----------------
  showRegister(edit) {
    this.show('register'); $('#controls').classList.add('hidden'); const S = Save.data; let age = S.profile ? S.profile.age : 7, level = S.profile ? S.profile.level : levelForAge(age), touched = !!S.profile;
    let color = COLORS[S.equip.color] ? S.equip.color : 'pink';
    const colors = STARTER_COLORS.concat(Object.keys(COLORS).filter((k) => !STARTER_COLORS.includes(k) && S.owned.includes('color:' + k)));
    $('#reg-nick').value = Online.child ? Online.child.nickname : S.profile ? S.profile.nick : ''; $('#reg-nick').disabled = !!Online.child;
    $('#reg-note').textContent = Online.child ? '닉네임은 보호자 메뉴에서 바꿀 수 있어요. 기록은 서버에 저장돼요.' : '실명 대신 별명을 써 주세요. 정보는 이 기기에만 저장돼요.';
    const draw = () => {
      $('#reg-blob').style.setProperty('--c', hexCss(COLORS[color].hex)); $('#reg-cname').textContent = COLORS[color].name;
      $('#reg-color').innerHTML = colors.map((k) => `<button class="sw ${k === color ? 'on' : ''}" data-c="${k}" style="--c:${hexCss(COLORS[k].hex)}" aria-label="${COLORS[k].name}"></button>`).join('');
      $('#reg-age').innerHTML = [6, 7, 8, 9, 10, 11, 12, 13].map((a) => `<button class="chip ${a === age ? 'on' : ''}" data-a="${a}">${a === 13 ? '13세+' : a + '세'}</button>`).join('');
      const rec = levelForAge(age);
      $('#reg-level').innerHTML = [1, 2, 3, 4, 5, 6].map((l) => `<button class="lvcard ${l === level ? 'on' : ''}" data-l="${l}">${l === rec ? '<span class="rec">추천</span>' : ''}<b>${LEVELS[l].icon} LV${l} ${LEVELS[l].name}</b><small>${LEVELS[l].ages} · ${LEVELS[l].desc}</small></button>`).join('');
      $$('#reg-color .sw').forEach((b) => (b.onclick = () => { color = b.dataset.c; Sound.play('click'); const bl = $('#reg-blob'); bl.classList.remove('boing'); void bl.offsetWidth; bl.classList.add('boing'); draw(); }));
      $$('#reg-age .chip').forEach((b) => (b.onclick = () => { age = +b.dataset.a; if (!touched) level = levelForAge(age); Sound.play('click'); draw(); }));
      $$('#reg-level .lvcard').forEach((b) => (b.onclick = () => { level = +b.dataset.l; touched = true; Sound.play('click'); draw(); }));
    };
    draw();
    $('#btn-reg').textContent = edit ? '저장하기' : '말랑 행성으로 출발!';
    $('#btn-reg').onclick = () => {
      const nick = Online.child ? Online.child.nickname : $('#reg-nick').value.trim().replace(/[<>"'&]/g, '');
      if (nick.length < 2) { $('#reg-nick').focus(); $('#reg-nick').style.borderColor = '#ff5a7a'; return; }
      const prevLevel = S.profile ? S.profile.level : null;
      S.profile = Object.assign(S.profile || { createdAt: new Date().toISOString() }, { nick, age, level });
      if (!S.owned.includes('color:' + color)) S.owned.push('color:' + color); S.equip.color = color;
      Save.save(); Sound.play('correct'); this.refreshPlayerLook(); this.enterHub();
      if (prevLevel && prevLevel !== level) this.toastHub(`수학 레벨이 LV${level} ${LEVELS[level].name}(으)로 바뀌었어요`);
    };
  },
});
