/** Screen 4: animated logo inside a ring, digits of pi scrolling along its edge. Agent B. */
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
        <svg class="pi-ring" viewBox="0 0 320 320" aria-hidden="true">
          <defs><path id="pi-path" d="M160 ${160 - R} a${R} ${R} 0 1 1 -0.01 0"/></defs>
          <circle class="pi-track" cx="160" cy="160" r="112"/>
          <circle class="pi-arc" cx="160" cy="160" r="112" pathLength="100"/>
          <g class="pi-digits"><text textLength="${LEN - 6}" lengthAdjust="spacing"><textPath href="#pi-path">${digits}</textPath></text></g>
        </svg>
        <div class="loading-logo">${SPILE.ui.logo(72)}<span class="brand-name">SPILE</span></div>
        <p class="caption loading-caption">Scoring every span</p>`,
      }));
    },
    show(el) { el.classList.remove('run'); void el.offsetWidth; el.classList.add('run'); },
  });
})();
