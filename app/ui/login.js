/** Screens 1 and 2: the three-way role split and the (fake) sign-in form. Agent B. */
(() => {
  'use strict';
  const { h } = SPILE.ui, E = SPILE.EVENTS, bus = SPILE.bus, R = SPILE.ROLES;

  const ROLES = [
    { id: R.RISK_MANAGER, name: 'Risk Manager', line: 'Where the risk is, what it costs, which plan clears the threshold', live: true },
    { id: R.OPERATOR, name: 'Regional Operator', sub: 'Grid utility', line: 'Which line segments are exposed, what to cut and when' },
    { id: R.PROCUREMENT, name: 'Procurement', line: 'What the works cost, and what inaction costs instead' },
  ];

  SPILE.ui.screen('login', {
    init(el) {
      el.append(
        h('header.brand', { html: SPILE.ui.logo(34) + '<span class="brand-name">SPILE</span>' }),
        h('div.roles', null, ROLES.map((r, i) =>
          h('button.role', {
            type: 'button', 'data-role': r.id, style: `--accent:${SPILE.ui.ACCENT[r.id]};--i:${i}`,
            onclick: () => bus.emit(E.ROLE_PICKED, { role: r.id }),
          },
            h('span.role-index', { text: '0' + (i + 1) }),
            h('span.role-name', { text: r.name }),
            r.sub && h('span.role-sub', { text: r.sub }),
            h('span.role-line', { text: r.line }),
            h('span.role-go', { text: r.live ? 'Sign in' : 'Not in this demo' })))),
        h('p.caption.login-caption', { text: SPILE.ui.SLOGAN }));
    },
  });

  let form, typing = 0;
  SPILE.ui.screen('auth', {
    init(el) {
      form = h('form.auth', { novalidate: true, autocomplete: 'off', onsubmit: e => { e.preventDefault(); bus.emit(E.AUTH_DONE, {}); } },
        h('div.auth-mark', { html: SPILE.ui.logo(44) }),
        h('p.eyebrow', { text: 'Risk Manager' }),
        h('h1.auth-title', { text: 'Sign in' }),
        h('label.field', null, h('span', { text: 'Email' }),
          h('input', { type: 'email', name: 'email', placeholder: 'name@organisation.it', spellcheck: 'false' })),
        h('label.field', null, h('span', { text: 'Password' }),
          h('input', { type: 'password', name: 'password', placeholder: '••••••••' })),
        h('button.btn.btn-primary', { type: 'submit', text: 'Sign in' }),
        h('button.btn-link', { type: 'button', text: 'Choose another role', onclick: () => bus.emit(E.SCREEN_BACK, {}) }));
      el.append(form);
    },
    // Storyboard panel 2: the credentials fill themselves in. Any input is accepted.
    show() {
      clearInterval(typing);
      const email = form.elements.email, pass = form.elements.password;
      const text = 'risk.manager@spile.it';
      email.value = ''; pass.value = '';
      let n = 0;
      setTimeout(() => {
        typing = setInterval(() => {
          email.value = text.slice(0, ++n);
          if (n >= text.length) { clearInterval(typing); pass.value = '••••••••••'; }
        }, 28);
      }, 500);
    },
    hide() { clearInterval(typing); },
  });
})();
