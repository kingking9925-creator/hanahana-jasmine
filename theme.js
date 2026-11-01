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
