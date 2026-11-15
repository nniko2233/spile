/**
 * Screen 4: logo inside a ring, digits of pi scrolling along its edge. Agent B.
 *
 * The map starts up behind this screen and keeps the main thread busy, so every
 * moving part here is an HTML layer animated with transform or opacity only:
 * those run on the compositor and stay smooth while the page is working.
 */
(() => {
  'use strict';
  const { h } = SPILE.ui;
  const PI = '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651';
  const R = 132, LEN = Math.round(2 * Math.PI * R);

  SPILE.ui.screen('loading', {
    init(el) {
      const digits = PI.slice(0, 92).split('').join(' ');
      el.append(h('div.loading', {
        html: `
        <div class="pi-layer pi-track"><svg viewBox="0 0 320 320" aria-hidden="true"><circle cx="160" cy="160" r="112"/></svg></div>
        <div class="pi-layer pi-arc"><svg viewBox="0 0 320 320" aria-hidden="true"><circle cx="160" cy="160" r="112" pathLength="100"/></svg></div>
        <div class="pi-layer pi-digits"><svg viewBox="0 0 320 320" aria-hidden="true">
          <defs><path id="pi-path" d="M160 ${160 - R} a${R} ${R} 0 1 1 -0.01 0"/></defs>
          <text textLength="${LEN - 6}" lengthAdjust="spacing"><textPath href="#pi-path">${digits}</textPath></text>
        </svg></div>
        <div class="loading-logo">${SPILE.ui.logo(72)}<span class="brand-name">SPILE</span></div>
        <p class="caption loading-caption">Scoring every span</p>`,
      }));
    },
  });
})();
