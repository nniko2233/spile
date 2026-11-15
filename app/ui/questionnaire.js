/**
 * Screen 3: profiling questionnaire. Agent B.
 * Reads as a 12-question form; only the three questions that drive the model are
 * asked. No budget question: the acceptable risk level is the constraint.
 */
(() => {
  'use strict';
  const { h } = SPILE.ui, E = SPILE.EVENTS, bus = SPILE.bus;
  const TOTAL = 12;

  const QUESTIONS = [
    { key: 'priority_asset', title: 'Top priority asset to protect', options: [
      { v: 'mv_line_settlement', label: 'MV line + downstream settlement' },
      { v: 'hv_line', label: 'HV transmission line' },
      { v: 'railway', label: 'Railway' },
      { v: 'road', label: 'Provincial road' },
      { v: 'hydro', label: 'Hydro intake' } ] },
    { key: 'risk_level', title: 'Acceptable risk level', options: [
      { v: 'green', label: 'Green', note: 'low', dot: SPILE.CLASS_COLOR.basso },
      { v: 'amber', label: 'Amber', note: 'moderate', dot: SPILE.CLASS_COLOR.medio },
      { v: 'red', label: 'Red', note: 'high', dot: SPILE.CLASS_COLOR.alto } ] },
    { key: 'horizon_years', title: 'Planning horizon', options: [
      { v: 5, label: '5 years' }, { v: 10, label: '10 years' },
      { v: 20, label: '20 years' }, { v: 30, label: '30 years' } ] },
  ];

  let root, step = 0, answers = {}, timer = null;

  function render() {
    clearTimeout(timer);
    const q = QUESTIONS[step];
    const done = step >= QUESTIONS.length;
    const n = Math.min(step + 1, QUESTIONS.length);
    root.replaceChildren(
      h('div.q-progress', null,
        h('span.q-count', { html: `<b>${n}</b> of ${TOTAL}` }),
        h('div.q-ticks', null, Array.from({ length: TOTAL }, (_, i) =>
          h('i', { class: i < step ? 'is-done' : i === step && !done ? 'is-now' : '' })))),
      done
        ? h('div.q-card.q-summary', null,
            h('p.eyebrow', { text: 'Your profile' }),
            h('ul.q-recap', null, QUESTIONS.map(x => {
              const o = x.options.find(o => o.v === answers[x.key]);
              return h('li', null, h('span', { text: x.title }),
                h('b', null, o.dot && h('i.dot', { style: `background:${o.dot}` }), o.label + (o.note ? ` (${o.note})` : '')));
            })),
            h('button.btn.btn-primary', { type: 'button', text: 'Build the risk map',
              onclick: () => bus.emit(E.SURVEY_DONE, { answers: Object.assign({}, answers) }) }),
            h('p.caption', { text: 'The other nine use your organisation defaults.' }))
        : h('div.q-card', null,
            h('p.eyebrow', { text: 'Question ' + n }),
            h('h1.q-title', { text: q.title }),
            h('div.q-options', null, q.options.map(o =>
              h('button.q-option', {
                type: 'button', class: answers[q.key] === o.v ? 'is-picked' : '',
                onclick: ev => {
                  answers[q.key] = o.v;
                  root.querySelectorAll('.q-option').forEach(b => b.classList.remove('is-picked'));
                  ev.currentTarget.classList.add('is-picked');
                  clearTimeout(timer);
                  timer = setTimeout(() => { step += 1; render(); }, 520);
                },
              }, o.dot && h('i.dot', { style: `background:${o.dot}` }), h('span', { text: o.label }),
                o.note && h('em', { text: o.note }))))),
      step > 0 && h('button.btn-link.q-back', { type: 'button', text: 'Back', onclick: () => { step -= 1; render(); } }));
  }

  SPILE.ui.screen('questionnaire', {
    init(el) { root = h('div.q'); el.append(root); },
    show() { step = 0; answers = {}; render(); },
    hide() { clearTimeout(timer); },
  });
})();
