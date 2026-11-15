/**
 * SPILE UI entry point. Owned by Agent B.
 *
 * index.html loads only this file; it loads the screen modules. Each module
 * registers one screen with SPILE.ui.screen(name, {init, show, hide}) and renders
 * into <section id="screen-<name>">. The shell (Agent A) is the only thing that
 * switches screens: modules react to screen:show and emit user intent on the bus.
 */
(() => {
  'use strict';
  const E = SPILE.EVENTS, bus = SPILE.bus;
  const screens = {};
  let current = null;

  /** Tiny DOM helper: h('div.cls', {attr}, child, ...) */
  function h(sel, attrs, ...kids) {
    const [tag, ...cls] = sel.split('.');
    const el = document.createElement(tag || 'div');
    if (cls.length) el.className = cls.join(' ');
    if (attrs) Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') { if (v) el.classList.add(...String(v).split(/\s+/).filter(Boolean)); }
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat(Infinity).forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  }

  /** k€ formatter: whole numbers from 10 up, finer below (real zones are small). */
  function k(v) {
    if (v == null || isNaN(v)) return '–';
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 10 || Number.isInteger(v)) return String(Math.round(v));
    if (a >= 1) return (Math.round(v * 10) / 10).toFixed(1);
    return (Math.round(v * 100) / 100).toFixed(2);
  }

  function activate(name, payload) {
    if (current && current !== name && screens[current] && screens[current].hide) {
      try { screens[current].hide(screens[current].el); } catch (e) { console.error(e); }
    }
    current = name;
    const s = screens[name];
    if (s && s.show) { try { s.show(s.el, payload || {}); } catch (e) { console.error(e); } }
  }

  SPILE.ui = {
    h, k,
    /** Role accents. Never red, amber or green: those mean risk. */
    ACCENT: { risk_manager: '#5ac8fa', operator: '#b48cff', procurement: '#ff7ab8' },
    SLOGAN: 'For Reliable Infrastructure',
    logo: (size = 40) => `<svg class="logo" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
      <path class="logo-a" d="M24 5 L37 20 H11 Z"/><path class="logo-b" d="M24 15 L40 32 H8 Z"/>
      <path class="logo-c" d="M6 43 H42" /><path class="logo-c" d="M24 32 V43"/></svg>`,
    screen(name, def) {
      def.el = document.getElementById('screen-' + name);
      if (!def.el) return;
      screens[name] = def;
      if (def.init) def.init(def.el);
      // Modules load after the first screen:show may have fired.
      if (SPILE.state && SPILE.state.screen === name) activate(name, { screen: name, prev: SPILE.state.prev });
    },
  };

  bus.on(E.SCREEN_SHOW, p => activate(p.screen, p));

  // One accent per role: the role whose turn it is colours every screen it works on.
  const SCREEN_ROLE = { operator: SPILE.ROLES.OPERATOR, procurement: SPILE.ROLES.PROCUREMENT, final: SPILE.ROLES.PROCUREMENT };
  bus.on(E.SCREEN_SHOW, p => {
    const stage = (SPILE.state && SPILE.state.stage) || SPILE.ROLES.RISK_MANAGER;
    document.body.dataset.role = SCREEN_ROLE[p.screen] || (p.screen === 'login' ? stage : SPILE.ROLES.RISK_MANAGER);
  });
  document.body.dataset.role = SPILE.ROLES.RISK_MANAGER;

  // The one permanent text on the map besides the compass.
  const host = document.getElementById('screens');
  if (host) host.append(h('div.demo-data', { text: 'Demo data' }));

  const base = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || 'app/ui/';
  ['login.js', 'questionnaire.js', 'loading.js', 'area.js', 'plans.js', 'flow.js'].forEach(f => {
    const s = document.createElement('script');
    s.src = base + f; s.async = false;
    document.head.append(s);
  });
})();
