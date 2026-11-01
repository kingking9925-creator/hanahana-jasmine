/* 花花 Jasmine 暗夜模式（全站共用）
   設定值存在 localStorage「jasmine-theme」：light / dark / system
   放在每頁 <head> 最前面，避免先閃一下亮色。 */
(function () {
  'use strict';
  var KEY = 'jasmine-theme', root = document.documentElement;
  function pref() { try { return localStorage.getItem(KEY) || 'light'; } catch (e) { return 'light'; } }
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function isDark(p) { return p === 'dark' || (p === 'system' && mq && mq.matches); }

  // 先蓋一層深色底，等頁面調整完再顯示
  var pre = document.createElement('style');
  pre.textContent = 'html[data-theme=dark]{background:#17131f;color-scheme:dark}html[data-theme=dark].th-wait body{opacity:0}' +
    'html[data-theme=dark] body{transition:opacity .15s}' +
    'html[data-theme=dark] img,html[data-theme=dark] video{filter:brightness(.92)}' +
    'html[data-theme=dark] ::selection{background:#c27cff55}';
  (document.head || root).appendChild(pre);

  /* ---- 顏色工具 ---- */
  function parse(c) { var m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; var a = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 }; }
  function lum(c) { var f = function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); }
  function rgb(c, a) { return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + (a == null ? c.a : a) + ')'; }
  // 亮背景 → 帶一點原本色調的深色
  function darkBg(c) { var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); var t = (mx - mn) / 255; var base = { r: 30, g: 25, b: 40 }; return { r: base.r + (c.r - mn) * .35 * (1 + t), g: base.g + (c.g - mn) * .35 * (1 + t), b: base.b + (c.b - mn) * .35 * (1 + t), a: c.a }; }
  // 深色文字 → 淺色（保留色相）
  function lightText(c) { var k = .72; return { r: c.r + (255 - c.r) * k, g: c.g + (255 - c.g) * k, b: c.b + (255 - c.b) * k, a: c.a }; }
  function gradientLight(img) { if (!/gradient\(/.test(img) || /url\(/.test(img)) return false; var cs = img.match(/rgba?\([^)]+\)/g); if (!cs) return false; var ok = 0; for (var i = 0; i < cs.length; i++) { var c = parse(cs[i]); if (c.a < .05) continue; if (lum(c) < .62) return false; ok++; } return ok > 0; }

  var touched = [], SKIP = { SCRIPT: 1, STYLE: 1, svg: 1, SVG: 1, path: 1, CANVAS: 1, IMG: 1, VIDEO: 1, IFRAME: 1, BR: 1, META: 1, LINK: 1, NOSCRIPT: 1 };
  function remember(el) { if (el.__th) return; el.__th = { bg: el.style.backgroundColor, bi: el.style.backgroundImage, c: el.style.color, bc: el.style.borderColor, bs: el.style.boxShadow }; touched.push(el); }
  function fix(el) {
    if (SKIP[el.tagName] || el.closest('[data-theme-keep]')) return;
    var s = getComputedStyle(el);
    var bg = parse(s.backgroundColor), img = s.backgroundImage;
    if (img && img !== 'none' && gradientLight(img)) { remember(el); el.style.backgroundImage = 'none'; el.style.backgroundColor = '#221b2e'; bg = null; }
    if (bg && bg.a > .35 && lum(bg) > .55) { remember(el); el.style.backgroundColor = rgb(darkBg(bg), Math.max(bg.a, .9)); }
    var c = parse(s.color);
    var ownGrad = img && img !== 'none' && /gradient\(/.test(img);
    if (c && lum(c) < .3 && !ownGrad) { remember(el); el.style.color = rgb(lightText(c)); }
    var bc = parse(s.borderTopColor);
    if (bc && parseFloat(s.borderTopWidth) > 0 && bc.a > .2 && lum(bc) > .55) { remember(el); el.style.borderColor = 'rgba(255,255,255,.12)'; }
    if (s.boxShadow && s.boxShadow !== 'none' && /rgba\((?:2[0-9]{2}|1[5-9][0-9]),/.test(s.boxShadow)) { remember(el); el.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)'; }
  }
  function walk(rootEl) { if (rootEl.nodeType !== 1) return; fix(rootEl); var all = rootEl.getElementsByTagName('*'); for (var i = 0; i < all.length; i++) fix(all[i]); }
  function restore() { touched.forEach(function (el) { var o = el.__th; el.style.backgroundColor = o.bg; el.style.backgroundImage = o.bi; el.style.color = o.c; el.style.borderColor = o.bc; el.style.boxShadow = o.bs; delete el.__th; }); touched = []; }

  var obs = null, active = false, queued = [];
  function flush() { var q = queued; queued = []; q.forEach(walk); }
  function start() {
    if (active) return; active = true;
    walk(document.body); root.classList.remove('th-wait');
    setTimeout(function () { if (active) walk(document.body); }, 900);
    obs = new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) queued.push(n); }); }); if (queued.length) requestAnimationFrame(flush); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  function stop() { active = false; if (obs) obs.disconnect(); restore(); }
  function apply(p) {
    var d = isDark(p);
    root.dataset.theme = d ? 'dark' : 'light';
    if (!document.body) { if (d) root.classList.add('th-wait'); return; }
    if (d) { stop(); start(); } else { stop(); root.classList.remove('th-wait'); }
  }
  window.jasmineTheme = {
    get: pref,
    set: function (p) { try { localStorage.setItem(KEY, p); } catch (e) {} apply(p); document.dispatchEvent(new CustomEvent('jasmine-theme', { detail: p })); },
    isDark: function () { return isDark(pref()); }
  };
  apply(pref());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(pref()); });
  setTimeout(function () { root.classList.remove('th-wait'); }, 1500);
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (pref() === 'system') apply('system'); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(pref()); });
})();

/* ---------- 花花游標（電腦版）＋ 治癒輕音樂 BGM ---------- */
(function () {
  'use strict';
  // 花花游標：白色茉莉花（一般）、粉色茉莉花（可點擊的地方）
  function flower(petal, stroke) {
    var p = '';
    for (var i = 0; i < 5; i++) p += '<ellipse cx="16" cy="9" rx="4.6" ry="7.2" transform="rotate(' + (i * 72) + ' 16 16)" fill="' + petal + '" stroke="' + stroke + '" stroke-width="1.3"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' + p + '<circle cx="16" cy="16" r="3.6" fill="#f2c14e" stroke="#e0a32e" stroke-width=".8"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 16 16';
  }
  var css = document.createElement('style');
  css.textContent = '@media (pointer:fine){html,body{cursor:' + flower('#ffffff', '#e48aae') + ',auto}' +
    'a,button,[role=button],label,summary,select,.nav-dd-btn,[onclick]{cursor:' + flower('#ffc1d8', '#c2457a') + ',pointer!important}' +
    'input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,[contenteditable]{cursor:text!important}}' +
    '.bgm-btn{position:fixed;left:16px;bottom:16px;z-index:9990;width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;' +
    'background:rgba(255,255,255,.88);box-shadow:0 6px 18px rgba(156,72,113,.22),inset 0 0 0 1px rgba(236,211,230,.9);backdrop-filter:blur(6px);font-size:18px;color:#9c4871;transition:transform .2s}' +
    '.bgm-btn:hover{transform:scale(1.08)}.bgm-btn .bars{display:flex;gap:2px;align-items:flex-end;height:16px}' +
    '.bgm-btn .bars i{width:3px;border-radius:2px;background:linear-gradient(#ff7aa2,#c27cff);height:4px}' +
    '.bgm-btn.on .bars i{animation:bgmBar 1.1s ease-in-out infinite}.bgm-btn.on .bars i:nth-child(2){animation-delay:-.4s}.bgm-btn.on .bars i:nth-child(3){animation-delay:-.7s}' +
    '@keyframes bgmBar{0%,100%{height:4px}50%{height:15px}}' +
    '.bgm-btn .off{display:none;font-size:16px}.bgm-btn:not(.on) .bars{display:none}.bgm-btn:not(.on) .off{display:block}' +
    '.bgm-btn .tip{position:absolute;left:52px;white-space:nowrap;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;background:rgba(48,38,60,.85);color:#fff;opacity:0;pointer-events:none;transition:opacity .3s}' +
    '.bgm-btn.hint .tip,.bgm-btn:hover .tip{opacity:1}' +
    'html[data-theme=dark] .bgm-btn{background:rgba(40,32,52,.9);box-shadow:0 6px 18px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.12);color:#ffc1d8}' +
    '@media (prefers-reduced-motion:reduce){.bgm-btn.on .bars i{animation:none;height:10px}}';
  (document.head || document.documentElement).appendChild(css);

  // ---- 原創輕音樂（Web Audio 即時生成，無版權問題）----
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  var KEY = 'jasmine-bgm', VOL = 0.07;
  function wantOn() { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } }
  function save(v) { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) {} }
  var ctx, master, bus, playing = false, timer = null, nextChord = 0, nextBell = 0, ci = 0;
  var CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59], [45, 52, 55, 60], [50, 53, 57, 60], [43, 50, 55, 59], [48, 52, 55, 64]];
  var CHORD_LEN = 7.5;
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function impulse(sec) {
    var len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return b;
  }
  function setup() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.3;
    var conv = ctx.createConvolver(); conv.buffer = impulse(4);
    var wet = ctx.createGain(); wet.gain.value = 0.55; var dry = ctx.createGain(); dry.gain.value = 0.6;
    bus = ctx.createGain(); bus.connect(lp); lp.connect(dry); lp.connect(conv); conv.connect(wet); dry.connect(master); wet.connect(master);
  }
  function pad(notes, t) {
    notes.forEach(function (m, k) {
      [-4, 4].forEach(function (det) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = k === 0 ? 'sine' : 'triangle'; o.frequency.value = hz(m); o.detune.value = det;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(k === 0 ? 0.11 : 0.05, t + 2.8);
        g.gain.setValueAtTime(k === 0 ? 0.11 : 0.05, t + CHORD_LEN - 0.5); g.gain.linearRampToValueAtTime(0, t + CHORD_LEN + 2.5);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + CHORD_LEN + 2.6);
      });
    });
  }
  function bell(m, t, v) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(m); o2.type = 'sine'; o2.frequency.value = hz(m) * 3.01;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.8);
    g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(v * 0.18, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0005, t + 1.2);
    o.connect(g); o2.connect(g2); g.connect(bus); g2.connect(bus); o.start(t); o2.start(t); o.stop(t + 3); o2.stop(t + 1.3);
  }
  function schedule() {
    var now = ctx.currentTime;
    while (nextChord < now + 1.5) {
      var ch = CHORDS[ci % CHORDS.length]; pad(ch, nextChord);
      bell(ch[0] - 12, nextChord, 0.05);
      ci++; nextChord += CHORD_LEN;
    }
    while (nextBell < now + 1.5) {
      var cur = CHORDS[(ci - 1 + CHORDS.length) % CHORDS.length];
      var tones = cur.map(function (m) { return m + 24; }).concat([cur[1] + 36]);
      if (Math.random() < 0.72) bell(tones[Math.floor(Math.random() * tones.length)], nextBell, 0.045 + Math.random() * 0.03);
      nextBell += [0.75, 1.5, 1.5, 2.25, 3][Math.floor(Math.random() * 5)];
    }
  }
  function start() {
    if (playing) return;
    if (!ctx) setup();
    if (ctx.state === 'suspended') ctx.resume();
    playing = true;
    var now = ctx.currentTime;
    if (nextChord < now) { nextChord = now + 0.1; nextBell = now + 1.2; }
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(VOL, now + 4);
    schedule(); timer = setInterval(schedule, 400);
    btn && btn.classList.add('on');
  }
  function stop(suspend) {
    if (!playing || !ctx) return;
    playing = false;
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + 1.2);
    clearInterval(timer); timer = null;
    setTimeout(function () { if (!playing && suspend !== false) ctx.suspend(); }, 1400);
    btn && btn.classList.remove('on');
  }

  var btn = null;
  function mount() {
    if (btn || !document.body) return;
    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'bgm-btn'; btn.setAttribute('data-theme-keep', '');
    btn.setAttribute('aria-label', '背景音樂開關');
    btn.innerHTML = '<span class="bars"><i></i><i></i><i></i></span><span class="off">🎵</span><span class="tip"></span>';
    if (document.getElementById('cv')) { btn.style.bottom = 'auto'; btn.style.top = '88px'; btn.style.left = '12px'; }
    document.body.appendChild(btn);
    var tip = btn.querySelector('.tip');
    function label() { tip.textContent = playing ? '關閉背景音樂' : (wantOn() ? '點任意處播放輕音樂 🎵' : '開啟背景音樂'); }
    label();
    if (wantOn()) { btn.classList.add('hint'); setTimeout(function () { btn.classList.remove('hint'); }, 5000); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (playing) { stop(); save(false); } else { start(); save(true); }
      label();
    });
    function firstGesture(e) {
      if (btn.contains(e.target)) return;
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.removeEventListener(t, firstGesture, true); });
      if (wantOn()) { start(); label(); }
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.addEventListener(t, firstGesture, true); });
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) { if (playing) { stop(); btn.dataset.resume = '1'; } }
      else if (btn.dataset.resume) { delete btn.dataset.resume; if (wantOn()) start(); label(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
