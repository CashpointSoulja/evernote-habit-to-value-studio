import * as E from './engine.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'habit-to-value-studio.v1';
const DAY = 86400000;
const say = msg => { const s = $('#status'); s.textContent = ''; setTimeout(() => { s.textContent = msg; }, 30); };
const pct = x => x == null ? 'n/a' : (x * 100).toFixed(1) + '%';
const pp = x => x == null ? 'n/a' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' pp';

const MEETING = {
  title: 'Weekly product sync (synthetic)',
  body: [
    'Attendees: Mara, Theo, Priya (fictional team)',
    'Onboarding test: draft two first-session journeys for review',
    'Theo to share the event contract with analytics by Thursday',
    'Priya to book five usability sessions with new note users',
    'Decided: no plan prompt before someone creates their first task',
    'Open question: how long to wait before reading refund data?',
    'Mara to write rollback criteria for the experiment',
    'Next sync: Monday',
  ].join('\n'),
};
const meaningful = t => t.trim().split(/\s+/).filter(Boolean).length >= 3;

function freshJourney(variant) {
  const start = Date.parse(new Date().toISOString().slice(0, 10) + 'T09:00:00Z');
  return { variant, job: null, startedAt: start, day: 0, revisitDay: null, note: variant === 'baseline' ? { title: 'Untitled', body: '' } : { ...MEETING }, noteSaved: false, savedAt: null, tasks: [], selected: [], events: [], seq: 0, upgradeDismissed: false, cue: null };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch { /* corrupt state falls back to fresh */ }
  return { v: 1, journey: 'task_first', j: { baseline: freshJourney('baseline'), task_first: freshJourney('task_first') }, analysis: { fixture: null, contract: {} } };
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { say('Could not save to local storage. Your changes are only in memory.'); } };
const J = () => S.j[S.journey];

function emit(type, extra = {}) {
  const j = J();
  const minutes = j.events.filter(e => Math.floor((Date.parse(e.occurred_at) - j.startedAt) / DAY) === j.day).length;
  const t = j.startedAt + j.day * DAY + (minutes + 1) * 60000;
  j.events.push({ event_id: `local-${j.variant}-${++j.seq}`, user_id: 'local-preview-user', variant: j.variant, assignment_seed: 'preview:local:50', acquisition_source: 'preview', event_type: type, occurred_at: new Date(t).toISOString().replace('.000Z', 'Z'), amount: '', currency: '', note_id: 'note-1', task_id: '', ...extra });
}
function ensureAssigned() { const j = J(); if (!j.events.length) emit('assigned', { note_id: '' }); }

function outcomes() {
  const j = J();
  const okTasks = new Set(j.tasks.filter(t => meaningful(t.text)).map(t => t.id));
  const evs = j.events.filter(e => e.event_type !== 'task_created' || okTasks.has(e.task_id)).map(e => ({ ...e, t: Date.parse(e.occurred_at), amountValue: 0 }));
  const a = evs.find(e => e.event_type === 'assigned');
  return a ? E.userOutcomes({ assignedAt: a.t, events: evs }) : { firstValue: false, repeatValue: false };
}

// ---------- tabs ----------
const tabs = [...document.querySelectorAll('[role=tab]')];
function selectTab(t, focus) {
  tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).hidden = !on; });
  if (focus) t.focus();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); selectTab(tabs[(i + k + tabs.length) % tabs.length], true); }
    if (e.key === 'Home') { e.preventDefault(); selectTab(tabs[0], true); }
    if (e.key === 'End') { e.preventDefault(); selectTab(tabs[tabs.length - 1], true); }
  });
});

// ---------- preview ----------
function renderPreview() {
  const j = J();
  document.querySelectorAll('input[name=journey]').forEach(r => { r.checked = r.value === S.journey; });
  const needsJob = j.variant === 'task_first' && !j.job;
  $('#job-chooser').hidden = j.variant !== 'task_first' || !!j.noteSaved;
  document.querySelectorAll('.job-opt').forEach(b => b.setAttribute('aria-checked', String(b.dataset.job === j.job)));
  $('#workspace').hidden = needsJob;
  $('#clock').textContent = `Simulated day ${j.day}`;
  if ($('#note-title') !== document.activeElement) $('#note-title').value = j.note.title;
  if ($('#note-body') !== document.activeElement) $('#note-body').value = j.note.body;
  $('#saved-at').textContent = j.savedAt ? `Saved locally · day ${j.savedAt.day}` : 'Not saved';
  const taskFirstMeeting = j.variant === 'task_first' && j.job === 'meeting';
  $('#line-picker').hidden = !taskFirstMeeting;
  const lines = j.note.body.split('\n').map((t, i) => ({ t, i })).filter(x => x.t.trim());
  const used = new Set(j.tasks.filter(t => t.line != null).map(t => t.lineText));
  $('#lines').innerHTML = lines.map(({ t, i }) => `<li><label><input type="checkbox" data-line="${i}" ${j.selected.includes(i) ? 'checked' : ''}><span class="${used.has(t.trim()) ? 'used' : ''}">${esc(t)}</span></label></li>`).join('');
  const sel = j.selected.filter(i => lines.some(l => l.i === i)).length;
  $('#make-tasks').disabled = !sel;
  $('#make-tasks').textContent = sel ? `Turn ${sel} selected line${sel > 1 ? 's' : ''} into tasks` : 'Turn selected lines into tasks';
  $('#task-list').innerHTML = j.tasks.map(t => `<li class="${t.done ? 'done' : ''}" data-id="${t.id}">
    <div class="task-row"><input type="checkbox" aria-label="Complete: ${esc(t.text)}" data-act="done" ${t.done ? 'checked' : ''}>
    <label class="sr-only" for="tt-${t.id}">Task text</label><textarea id="tt-${t.id}" data-act="text" rows="1">${esc(t.text)}</textarea>
    <button class="icon-btn" data-act="del" aria-label="Delete task: ${esc(t.text)}">Delete</button></div>
    <p class="task-meta">${t.line != null ? `From note line ${t.line + 1}` : 'Added by hand'} · created day ${t.createdDay}${t.done ? ` · done day ${t.doneDay}` : ''}${meaningful(t.text) ? '' : ' · <span class="warn">fewer than 3 words, so it does not count toward first value</span>'}</p></li>`).join('');
  $('#no-tasks').hidden = j.tasks.length > 0;
  $('#tasks-sub').textContent = j.variant === 'baseline' ? '(optional in this journey)' : 'from this note';
  const open = j.tasks.filter(t => !t.done).length;
  $('#count-open').textContent = open; $('#count-done').textContent = j.tasks.length - open;
  const o = outcomes();
  $('#m-first').textContent = `First value: ${o.firstValue ? 'reached' : 'not yet'}`; $('#m-first').classList.toggle('ok', o.firstValue);
  $('#m-repeat').textContent = `Repeat value: ${o.repeatValue ? 'reached' : 'not yet'}`; $('#m-repeat').classList.toggle('ok', o.repeatValue);
  $('#revisit-state').textContent = j.revisitDay ? `Revisit scheduled for simulated day ${j.revisitDay}. No notification will be sent.` : (j.day > 0 ? `You are on simulated day ${j.day}. Schedule a later day to revisit again.` : 'No revisit scheduled.');
  [...$('#revisit-day').options].forEach(op => { op.disabled = Number(op.value) <= j.day; });
  if ($('#revisit-day').selectedOptions[0]?.disabled) { const first = [...$('#revisit-day').options].find(op => !op.disabled); if (first) $('#revisit-day').value = first.value; }
  $('#simulate').disabled = !j.revisitDay;
  const cue = $('#cue');
  cue.hidden = !j.cue; cue.className = 'cue' + (j.cue?.generic ? ' generic' : ''); cue.innerHTML = j.cue?.html || '';
  const showUpgrade = !j.upgradeDismissed && (j.variant === 'baseline' ? j.noteSaved : o.repeatValue);
  $('#upgrade').hidden = !showUpgrade;
  $('#log-count').textContent = j.events.length;
  $('#log').innerHTML = j.events.map(e => `<tr><td class="mono">${e.event_type}</td><td class="mono">${e.occurred_at}</td><td>${e.variant}</td><td>${esc(e.note_id)}</td><td>${esc(e.task_id)}</td></tr>`).join('');
}

document.querySelectorAll('input[name=journey]').forEach(r => r.addEventListener('change', () => { S.journey = r.value; ensureAssigned(); save(); renderPreview(); say(`Switched to ${r.value === 'baseline' ? 'baseline blank-note' : 'task-first job-led'} journey. Each journey keeps its own local state.`); }));
document.querySelectorAll('.job-opt').forEach(b => b.addEventListener('click', () => {
  const j = J(); j.job = b.dataset.job;
  if (j.job !== 'meeting') { j.note = { title: 'Untitled', body: '' }; say('That job is out of scope for this experiment. Opened a blank note.'); }
  else { j.note = { ...MEETING }; say('Opened the synthetic meeting note. Tick lines that need doing.'); }
  save(); renderPreview(); $('#note-body').focus();
}));
$('.jobs').addEventListener('keydown', e => {
  const opts = [...document.querySelectorAll('.job-opt')]; const i = opts.indexOf(document.activeElement);
  const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  if (k && i >= 0) { e.preventDefault(); opts[(i + k + opts.length) % opts.length].focus(); }
});
$('#note-title').addEventListener('input', e => { J().note.title = e.target.value; save(); });
$('#note-body').addEventListener('input', e => { const j = J(); j.note.body = e.target.value; const n = j.note.body.split('\n').length; j.selected = j.selected.filter(i => i < n); save(); renderPreview(); });
function saveNote() {
  const j = J(); ensureAssigned();
  emit('note_saved'); j.noteSaved = true; j.savedAt = { day: j.day };
  save(); renderPreview(); say(`Note saved locally on simulated day ${j.day}.`);
}
$('#save-note').addEventListener('click', saveNote);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('#panel-preview').hidden) { e.preventDefault(); saveNote(); } });
$('#lines').addEventListener('change', e => {
  const i = Number(e.target.dataset.line); const j = J();
  j.selected = e.target.checked ? [...new Set([...j.selected, i])] : j.selected.filter(x => x !== i);
  save(); renderPreview(); document.querySelector(`#lines input[data-line="${i}"]`)?.focus();
});
function addTask(text, line) {
  const j = J(); ensureAssigned();
  const id = 'task-' + (j.tasks.length ? Math.max(...j.tasks.map(t => Number(t.id.split('-')[1]))) + 1 : 1);
  j.tasks.push({ id, text, line, lineText: line != null ? text : null, done: false, createdDay: j.day, doneDay: null });
  emit('task_created', { task_id: id });
}
$('#make-tasks').addEventListener('click', () => {
  const j = J(); const lines = j.note.body.split('\n');
  if (!j.noteSaved) saveNote();
  const n = j.selected.length;
  j.selected.sort((a, b) => a - b).forEach(i => { const t = (lines[i] || '').trim(); if (t) addTask(t, i); });
  j.selected = []; save(); renderPreview(); say(`${n} task${n > 1 ? 's' : ''} created. The original note is unchanged.`);
});
$('#add-task').addEventListener('submit', e => {
  e.preventDefault(); const v = $('#new-task').value.trim(); if (!v) return;
  addTask(v, null); $('#new-task').value = ''; save(); renderPreview(); say('Task added.'); $('#new-task').focus();
});
$('#task-list').addEventListener('change', e => {
  const li = e.target.closest('li'); if (!li) return; const j = J(); const t = j.tasks.find(x => x.id === li.dataset.id);
  if (e.target.dataset.act === 'done') {
    t.done = e.target.checked; t.doneDay = t.done ? j.day : null;
    if (t.done) emit('task_completed', { task_id: t.id });
    save(); renderPreview(); document.querySelector(`li[data-id="${t.id}"] input[data-act=done]`)?.focus();
    say(t.done ? `Completed on simulated day ${j.day}.` : 'Marked open again.');
  }
  if (e.target.dataset.act === 'text') { t.text = e.target.value.trim() || t.text; save(); renderPreview(); }
});
$('#task-list').addEventListener('click', e => {
  if (e.target.dataset.act !== 'del') return; const j = J(); const id = e.target.closest('li').dataset.id;
  j.tasks = j.tasks.filter(t => t.id !== id); save(); renderPreview(); say('Task deleted. Its earlier event stays in the log.');
});
$('#schedule').addEventListener('click', () => { const j = J(); j.revisitDay = Number($('#revisit-day').value); save(); renderPreview(); say(`Revisit scheduled for simulated day ${j.revisitDay}. No notification will be sent.`); });
$('#simulate').addEventListener('click', () => {
  const j = J(); if (!j.revisitDay) return;
  ensureAssigned(); j.day = j.revisitDay; j.revisitDay = null; emit('revisited');
  const open = j.tasks.filter(t => !t.done);
  if (j.variant === 'task_first') {
    j.cue = { html: `<b>Day ${j.day} · Welcome back.</b> ${open.length ? `${open.length} open task${open.length > 1 ? 's' : ''} from “${esc(j.note.title)}”: <ul>${open.slice(0, 4).map(t => `<li>${esc(t.text)}</li>`).join('')}</ul>Tick one off to finish what you started.` : 'No open tasks from your note.'} <span class="tiny">(Simulated cue. No real notification was sent.)</span>` };
  } else {
    j.cue = { generic: true, html: `<b>Day ${j.day}.</b> You have 1 note${j.tasks.length ? ` and ${open.length} open task${open.length === 1 ? '' : 's'}` : ''}. <span class="tiny">(Simulated revisit. No real notification was sent.)</span>` };
  }
  save(); renderPreview(); say(`Simulated revisit on day ${j.day}.`); $('#cue').focus?.();
});
$('#up-preview').addEventListener('click', () => { $('#up-msg').textContent = 'Checkout would show the plan, the price and a cancel option. This is a mock: nothing was purchased and no payment screen exists.'; });
$('#up-dismiss').addEventListener('click', () => { J().upgradeDismissed = true; save(); renderPreview(); say('Plan preview dismissed.'); });
$('#reset').addEventListener('click', () => {
  if (!confirm('Reset all local data for both journeys and the analysis? This cannot be undone.')) return;
  localStorage.removeItem(KEY); S = load(); ensureAssigned(); save(); renderPreview(); resetAnalysis(); say('Local data reset.');
});
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
$('#export-state').addEventListener('click', () => download('habit-to-value-local-state.json', JSON.stringify({ exportedAt: new Date().toISOString(), notice: 'Synthetic, browser-local data from an independent concept. Not affiliated with Evernote or Bending Spoons.', state: S }, null, 2), 'application/json'));
$('#export-log').addEventListener('click', () => download(`session-${J().variant}.csv`, E.toCSV(J().events), 'text/csv'));

// ---------- analysis ----------
let A = { name: null, text: null, result: null };
const CONTRACT_FIELDS = [
  ['firstValueMinTasks', 'First value: minimum tasks in first 24 h', 1, 5, 1],
  ['repeatWindowDays', 'Repeat-value window (days)', 2, 14, 1],
  ['revenueWindowDays', 'Revenue/refund mature window (days)', 7, 60, 1],
  ['minMatureUsersPerArm', 'Minimum mature users per arm', 10, 5000, 10],
  ['guardrailRepeatDropPp', 'Guardrail: max repeat-value drop (pp)', 0, 10, 0.5],
  ['guardrailRefundRisePp', 'Guardrail: max refunded-user rise (pp)', 0, 10, 0.5],
  ['guardrailCancelRisePp', 'Guardrail: max cancellation rise (pp)', 0, 10, 0.5],
];
function contract() { return { ...E.DEFAULT_CONTRACT, ...S.analysis.contract }; }
function renderContract() {
  const c = contract();
  $('#contract').innerHTML = CONTRACT_FIELDS.map(([k, l, min, max, step]) => `<label>${l}<input type="number" name="${k}" min="${min}" max="${max}" step="${step}" value="${c[k]}"></label>`).join('') +
    `<p class="tiny muted" style="grid-column:1/-1">Primary metric: seven-day repeat value. Randomisation unit: user. Denominator: intent-to-treat, mature assigned users. Fixed thresholds: quarantine ≤ ${c.maxQuarantineShare * 100}%, orphans ≤ ${c.maxOrphanShare * 100}%, assignment issues ≤ ${c.maxAssignmentIssueShare * 100}%, immature ≤ ${c.maxImmatureShare * 100}%, SRM chi-square ≤ ${c.srmChiSquareThreshold}.</p>`;
}
function resetAnalysis() {
  A = { name: null, text: null, result: null };
  ['#step-validate', '#step-contract', '#step-results', '#step-segments', '#step-decision'].forEach(s => { $(s).hidden = true; });
  document.querySelectorAll('.fx').forEach(b => b.setAttribute('aria-pressed', 'false'));
  $('#import-state').textContent = 'No cohort loaded.';
}
async function loadFixture(name) {
  $('#import-state').textContent = `Loading ${name}.csv…`;
  const res = await fetch(`/fixtures/${name}.csv`);
  if (!res.ok) { $('#import-state').textContent = `Could not load ${name}.csv (HTTP ${res.status}).`; return; }
  importText(`${name}.csv`, await res.text());
  document.querySelectorAll('.fx').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fx === name)));
  S.analysis.fixture = name; save();
}
function importText(name, text) {
  A = { name, text, result: null };
  const v = E.validate(text);
  const c = v.headerErrors.length ? null : E.buildCohort(v, contract());
  const q = [...v.quarantined, ...(c?.quarantined || [])];
  $('#import-state').textContent = `Loaded ${name}: ${v.totalRows} rows.`;
  const users = c ? c.users.length : 0;
  $('#validate-out').innerHTML = v.headerErrors.length ? `<div class="warnbox"><b>Schema invalid.</b> ${esc(v.headerErrors.join('; '))}. Expected columns: <code>${E.FIELDS.join(',')}</code></div>` : `
    <div class="stats">
      <div class="stat"><b>${v.totalRows}</b><span>rows read</span></div>
      <div class="stat"><b>${v.valid.length - (c?.quarantined.length || 0)}</b><span>valid events used</span></div>
      <div class="stat"><b>${q.length}</b><span>quarantined rows</span></div>
      <div class="stat"><b>${v.duplicatesRemoved}</b><span>exact duplicates counted once</span></div>
      <div class="stat"><b>${users}</b><span>assigned users (counted once)</span></div>
      <div class="stat"><b>${c ? c.users.filter(u => u.variant === 'task_first').length : 0} / ${c ? c.users.filter(u => u.variant === 'baseline').length : 0}</b><span>task-first / baseline</span></div>
    </div>
    ${q.length ? `<details><summary>Quarantined rows and reasons (${q.length})</summary><div class="table-wrap"><table><thead><tr><th class="num">Line</th><th>event_id</th><th>user_id</th><th>event_type</th><th>Reason</th></tr></thead><tbody>${q.slice(0, 200).map(x => `<tr><td class="num">${x.row._line}</td><td class="mono">${esc(x.row.event_id)}</td><td class="mono">${esc(x.row.user_id)}</td><td>${esc(x.row.event_type)}</td><td>${esc(x.reasons.join('; '))}</td></tr>`).join('')}</tbody></table></div>${q.length > 200 ? `<p class="tiny">Showing 200 of ${q.length}. All are in the export.</p>` : ''}</details>` : '<p>No rows quarantined.</p>'}
    <p class="tiny muted">Users come only from <code>assigned</code> rows. Other event rows add outcomes to a user and never add users.</p>`;
  $('#step-validate').hidden = false; $('#step-contract').hidden = false;
  ['#step-results', '#step-segments', '#step-decision'].forEach(s => { $(s).hidden = true; });
  renderContract();
  say(`${name} loaded. ${q.length} rows quarantined. Review the contract, then analyse.`);
}
document.querySelectorAll('.fx').forEach(b => b.addEventListener('click', () => loadFixture(b.dataset.fx)));
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 5e6) { $('#import-state').textContent = 'File too large for an in-browser demo (5 MB max).'; return; }
  document.querySelectorAll('.fx').forEach(b => b.setAttribute('aria-pressed', 'false'));
  importText(f.name, await f.text());
});
$('#contract').addEventListener('submit', e => e.preventDefault());
$('#run').addEventListener('click', () => {
  const fd = new FormData($('#contract')); const c = {};
  for (const [k] of CONTRACT_FIELDS) { const n = Number(fd.get(k)); if (Number.isFinite(n)) c[k] = n; }
  S.analysis.contract = c; save();
  A.result = E.analyze(A.text, c);
  renderResults(); $('#decision').focus();
  say(`Decision: ${A.result.decision.replace('_', ' ')}.`);
});
function ciTxt(ci) { return ci ? `${pct(ci[0])}–${pct(ci[1])}` : 'n/a'; }
function renderResults() {
  const r = A.result, cur = r.validation.currency;
  $('#gates').innerHTML = `<h3>Quality gates</h3>` + r.gates.map(g => `<div class="gate"><span class="badge ${g.pass ? 'pass' : 'fail'}">${g.pass ? 'PASS' : 'FAIL'}</span><div><b>${esc(g.id)}</b>: ${esc(g.detail)}</div></div>`).join('');
  if (r.arms) {
    $('#results').innerHTML = `<h3 style="margin-top:16px">Outcomes</h3><div class="table-wrap"><table><thead><tr><th>Metric</th><th class="num">Task-first</th><th class="num">Baseline</th><th class="num">Difference</th><th class="num">95% interval</th></tr></thead><tbody>${E.METRICS.map(m => {
      const t = r.arms.task_first[m.key], b = r.arms.baseline[m.key], d = r.diffs[m.key];
      if (m.kind === 'rate') return `<tr><td>${m.label}</td><td class="num">${t.k}/${t.n} · ${pct(t.rate)}<br><span class="tiny muted">${ciTxt(t.ci)}</span></td><td class="num">${b.k}/${b.n} · ${pct(b.rate)}<br><span class="tiny muted">${ciTxt(b.ci)}</span></td><td class="num">${d ? pp(d.diff) : 'n/a'}</td><td class="num">${d ? pp(d.lo) + ' to ' + pp(d.hi) : 'n/a'}</td></tr>`;
      return `<tr><td>${m.label} <span class="tiny muted">(synthetic ${esc(cur || '')}, ${r.contract.revenueWindowDays}-day window)</span></td><td class="num">${E.money(t.mean, cur)}<br><span class="tiny muted">n=${t.n}</span></td><td class="num">${E.money(b.mean, cur)}<br><span class="tiny muted">n=${b.n}</span></td><td class="num">${d ? E.money(d.diff, cur) : 'n/a'}</td><td class="num">${d ? E.money(d.lo, cur) + ' to ' + E.money(d.hi, cur) : 'n/a'}</td></tr>`;
    }).join('')}</tbody></table></div><p class="tiny muted">Rates count users, not event rows. Intervals use a normal approximation (Wilson for single rates). They are descriptive, with no correction for looking at several metrics. Immature users (${r.cohort.users.length - r.matureCounts.task_first - r.matureCounts.baseline}) are excluded from every outcome.</p>`;
    $('#step-segments').hidden = false; renderSegments();
  } else { $('#results').innerHTML = ''; $('#step-segments').hidden = true; }
  $('#guardrails').innerHTML = r.guardrails.length ? `<h3>Guardrails (aggregate, mature users)</h3>` + r.guardrails.map(g => `<div class="gate"><span class="badge ${g.pass ? 'pass' : 'fail'}">${g.pass ? 'PASS' : 'FAIL'}</span><div>${esc(g.detail)}</div></div>`).join('') : '<p class="muted">Guardrails were not evaluated because the cohort failed the schema check.</p>';
  const label = { SCALE: 'Scale to next ramp step', ITERATE: 'Iterate: do not scale', REJECT: 'Reject rollout', NO_DECISION: 'No decision: refuse to call a winner' }[r.decision];
  $('#decision').className = 'decision ' + r.decision;
  $('#decision').innerHTML = `<p class="tiny" style="margin:0 0 4px;font-weight:700;letter-spacing:.06em">${r.decision.replace('_', ' ')}</p><h3>${label}</h3><ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${r.decision === 'NO_DECISION' ? '<p class="tiny">Each failed gate is listed above. Fix the export or wait for the cohort to mature, then re-run. This tool will not show a winner until every gate passes.</p>' : ''}`;
  $('#step-results').hidden = false; $('#step-decision').hidden = false;
}
function renderSegments() {
  const r = A.result; const k = $('#seg-metric').value; const s = r.segments[k];
  const max = Math.max(0.01, ...s.rows.flatMap(x => [x.rateT || 0, x.rateB || 0]));
  const w = r.warnings.find(x => x.id === 'mix-' + k);
  $('#segments').innerHTML = `${w ? `<div class="warnbox" role="alert"><b>Warning: acquisition-mix confounding.</b> ${esc(w.detail)}</div>` : ''}
  <div class="table-wrap"><table><thead><tr><th>Source</th><th class="num">Task-first k/n</th><th class="num">Baseline k/n</th><th class="num">Difference</th><th class="num">Share of task-first</th><th class="num">Share of baseline</th><th class="num">Pooled share</th></tr></thead><tbody>
  ${s.rows.map(x => `<tr><td>${esc(x.source)}</td><td class="num">${x.kT}/${x.nT} · ${pct(x.rateT)}</td><td class="num">${x.kB}/${x.nB} · ${pct(x.rateB)}</td><td class="num">${x.rateT != null && x.rateB != null ? pp(x.rateT - x.rateB) : 'n/a'}</td><td class="num">${pct(x.shareT)}</td><td class="num">${pct(x.shareB)}</td><td class="num">${pct(x.pooledShare)}</td></tr>`).join('')}
  <tr><th>Aggregate (as observed)</th><th class="num">${pct(s.aggregate.t)}</th><th class="num">${pct(s.aggregate.b)}</th><th class="num">${pp(s.aggregate.diff)}</th><th colspan="3" class="tiny">Each arm weighted by its own source mix</th></tr>
  <tr><th>Fixed mix (pooled weights)</th><th class="num">${pct(s.fixedMix.t)}</th><th class="num">${pct(s.fixedMix.b)}</th><th class="num">${pp(s.fixedMix.diff)}</th><th colspan="3" class="tiny">Both arms weighted to the same pooled source mix</th></tr>
  </tbody></table></div>
  <div class="bars" aria-hidden="true">${s.rows.map(x => `<div class="bar"><span>${esc(x.source)}</span><div><div class="track"><div class="fill" style="width:${((x.rateT || 0) / max) * 100}%"></div></div><div class="track" style="margin-top:2px"><div class="fill b" style="width:${((x.rateB || 0) / max) * 100}%"></div></div></div><span class="tiny">${pct(x.rateT)} / ${pct(x.rateB)}</span></div>`).join('')}</div>
  <p class="tiny muted">Green bar: task-first. Grey bar: baseline. Source-mix difference between arms (total variation): ${(s.mixDistance * 100).toFixed(0)}%.${s.missingSegments.length ? ' Sources in only one arm (excluded from fixed mix): ' + esc(s.missingSegments.join(', ')) + '.' : ''} If the fixed-mix difference disagrees with the aggregate, the headline is driven by who arrived in each arm.</p>`;
}
$('#seg-metric').addEventListener('change', renderSegments);
$('#export-memo').addEventListener('click', () => download(`evidence-memo-${(A.name || 'cohort').replace(/\.csv$/, '')}.md`, E.memo(A.result, { name: A.name }), 'text/markdown'));
$('#export-quarantine').addEventListener('click', () => {
  const q = [...A.result.validation.quarantined, ...(A.result.cohort?.quarantined || [])];
  download(`quarantined-${(A.name || 'cohort').replace(/\.csv$/, '')}.csv`, E.toCSV(q.map(x => ({ ...x.row, line: x.row._line, reasons: x.reasons.join('; ') })), [...E.FIELDS, 'line', 'reasons']), 'text/csv');
});

ensureAssigned(); save(); renderPreview();
if (S.analysis.fixture) loadFixture(S.analysis.fixture);
