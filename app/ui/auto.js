/**
 * ?auto — plays the whole demo by itself, for recording the video. Agent B.
 *
 * It presses what a presenter would press (SPILE.shell.next, the questionnaire
 * options), waiting on the real screen changes, so it cannot drift from the app.
 * `?auto=fast` shortens the pauses. Any key or click stops it.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (!params.has('auto')) return;
  const speed = params.get('auto') === 'fast' ? 0.55 : 1;
  let stopped = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms * speed));
  const until = (test, max = 30000) => new Promise(resolve => {
    const t0 = performance.now();
    (function poll() { if (stopped || test() || performance.now() - t0 > max) resolve(); else setTimeout(poll, 80); })();
  });
  const on = s => () => SPILE.state.screen === s;
  const next = () => { if (!stopped) SPILE.shell.next(); };
  const click = sel => { const el = document.querySelector(sel); if (el && !stopped) el.click(); };

  const stop = e => { if (e.isTrusted) stopped = true; };
  ['keydown', 'mousedown', 'touchstart'].forEach(t => window.addEventListener(t, stop, { capture: true, passive: true }));

  async function run() {
    await until(on('login')); await sleep(2600); next();                       // 1 role picker
    await until(on('auth')); await sleep(2300); next();                        // 2 sign-in fills itself
    await until(on('questionnaire')); await sleep(1200);                       // 3 three answers
    click('.q-option:nth-child(1)'); await sleep(1300);
    click('.q-option:nth-child(1)'); await sleep(1300);
    click('.q-option:nth-child(3)'); await sleep(1700);
    click('.q-summary .btn-primary');
    await until(on('map'), 40000);                                             // 4 loading, 5 map and intro
    await until(() => SPILE.state.introDone, 20000); await sleep(1600); next();
    await until(on('area')); await sleep(2600);                                // 6 area panel, read down
    const panel = document.querySelector('.area-scroll');
    if (panel) panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
    await sleep(3200); next();
    const has = sel => () => !!document.querySelector(sel);
    await until(on('plans')); await until(has('.plans-panel.is-judged')); await sleep(1700); next();   // 7 bars, threshold, then toggle
    await until(has('.plan-row.is-on')); await sleep(3400); next();            //   save: ring step 1
    await until(on('login')); await sleep(1700); next();                       //   role picker, operator
    for (const screen of ['operator', 'procurement']) {
      await until(on(screen)); await sleep(3200); next();                      // 8 / 9 the pin, then the question
      await until(has('.ask')); await sleep(1100); next();                     //   pop-up fills
      await until(has('.popup-foot .btn:not(:disabled)')); await sleep(1500); next();   //   save: next ring step
      if (screen === 'operator') { await until(on('login')); await sleep(1700); next(); }   //   role picker, procurement
    }
    await until(has('tr.is-assigned')); await sleep(3200); next();             // 10 three roles
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
