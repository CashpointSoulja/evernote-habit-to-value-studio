// Habit-to-Value analysis engine. Pure functions, no DOM, no network.
// Shared by the browser UI and the test suite.

export const FIELDS = ['event_id', 'user_id', 'variant', 'assignment_seed', 'acquisition_source', 'event_type', 'occurred_at', 'amount', 'currency', 'note_id', 'task_id'];
export const EVENT_TYPES = ['assigned', 'note_saved', 'task_created', 'revisited', 'task_completed', 'trial_started', 'paid', 'refunded', 'cancelled'];
export const VARIANTS = ['baseline', 'task_first'];
export const MONEY_EVENTS = ['paid', 'refunded'];
const DAY = 86400000;

export const DEFAULT_CONTRACT = Object.freeze({
  firstValueMinTasks: 1,          // first value = note saved + at least N meaningful tasks in first 24h
  meaningfulTaskMinChars: 0,      // reserved for preview; CSV rows carry no task text
  repeatWindowDays: 7,            // repeat value = later-day revisit + task completion within N days
  revenueWindowDays: 14,          // fixed mature window for paid/refund/cancel
  minMatureUsersPerArm: 150,
  maxQuarantineShare: 0.05,
  maxImmatureShare: 0.25,
  maxAssignmentIssueShare: 0.01,
  maxOrphanShare: 0.01,
  srmChiSquareThreshold: 10.83,   // chi-square, 1 df, alpha 0.001
  guardrailRepeatDropPp: 1.0,
  guardrailRefundRisePp: 1.0,
  guardrailCancelRisePp: 2.0,
  confoundMixDistance: 0.10,
  primaryMetric: 'repeatValue',
});

// ---------- CSV ----------
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false, i = 0;
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

export function toCSV(records, fields = FIELDS) {
  const esc = v => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return [fields.join(','), ...records.map(r => fields.map(f => esc(r[f])).join(','))].join('\n') + '\n';
}

// ---------- assignment ----------
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
// Seed format: experiment:phase:treatmentPercent, e.g. hv1:main:50
export function parseSeed(seed) {
  const m = /^([a-z0-9_-]+):([a-z0-9_-]+):(\d{1,2})$/i.exec(seed || '');
  if (!m) return null;
  const alloc = Number(m[3]);
  if (alloc < 1 || alloc > 99) return null;
  return { experiment: m[1], phase: m[2], treatmentPercent: alloc };
}
export function expectedVariant(userId, seed) {
  const p = parseSeed(seed);
  if (!p) return null;
  return (fnv1a(seed + '|' + userId) % 100) < p.treatmentPercent ? 'task_first' : 'baseline';
}

// ---------- validation ----------
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const MONEY = /^\d{1,7}(\.\d{1,2})?$/;

function rowProblems(r) {
  const p = [];
  for (const f of ['event_id', 'user_id', 'variant', 'assignment_seed', 'acquisition_source', 'event_type', 'occurred_at']) if (!r[f]) p.push('missing ' + f);
  if (r.variant && !VARIANTS.includes(r.variant)) p.push('unknown variant "' + r.variant + '"');
  if (r.event_type && !EVENT_TYPES.includes(r.event_type)) p.push('unknown event_type "' + r.event_type + '"');
  if (r.assignment_seed && !parseSeed(r.assignment_seed)) p.push('malformed assignment_seed "' + r.assignment_seed + '"');
  if (r.acquisition_source && !/^[a-z][a-z0-9_]*$/.test(r.acquisition_source)) p.push('malformed acquisition_source');
  if (r.occurred_at && (!ISO.test(r.occurred_at) || Number.isNaN(Date.parse(r.occurred_at)))) p.push('malformed timestamp "' + r.occurred_at + '"');
  if (MONEY_EVENTS.includes(r.event_type)) {
    if (!MONEY.test(r.amount || '') || Number(r.amount) <= 0) p.push('malformed or non-positive amount "' + (r.amount ?? '') + '"');
    if (!/^[A-Z]{3}$/.test(r.currency || '')) p.push('missing or malformed currency');
  } else if (r.event_type && r.amount && r.amount !== '0' && r.amount !== '0.00') {
    p.push('amount on non-money event');
  }
  if (r.event_type === 'note_saved' && !r.note_id) p.push('note_saved without note_id');
  if ((r.event_type === 'task_created' || r.event_type === 'task_completed') && !r.task_id) p.push(r.event_type + ' without task_id');
  return p;
}

export function validate(text) {
  const table = parseCSV(text);
  const out = { header: [], totalRows: 0, valid: [], quarantined: [], duplicatesRemoved: 0, headerErrors: [] };
  if (!table.length) { out.headerErrors.push('file is empty'); return out; }
  const header = table[0].map(h => h.trim());
  out.header = header;
  const missing = FIELDS.filter(f => !header.includes(f));
  if (missing.length) { out.headerErrors.push('missing columns: ' + missing.join(', ')); out.totalRows = table.length - 1; return out; }
  const seen = new Map();
  const currencies = new Set();
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const r = {};
    header.forEach((h, j) => { r[h] = (cells[j] ?? '').trim(); });
    r._line = i + 1;
    out.totalRows++;
    if (cells.length !== header.length) { out.quarantined.push({ row: r, reasons: ['expected ' + header.length + ' columns, found ' + cells.length] }); continue; }
    const probs = rowProblems(r);
    if (probs.length) { out.quarantined.push({ row: r, reasons: probs }); continue; }
    const key = FIELDS.map(f => r[f]).join('\u0001');
    if (seen.has(r.event_id)) {
      if (seen.get(r.event_id) === key) out.duplicatesRemoved++;
      else out.quarantined.push({ row: r, reasons: ['event_id ' + r.event_id + ' reused with different content'] });
      continue;
    }
    seen.set(r.event_id, key);
    if (MONEY_EVENTS.includes(r.event_type)) currencies.add(r.currency);
    r.t = Date.parse(r.occurred_at);
    r.amountValue = MONEY_EVENTS.includes(r.event_type) ? Math.round(Number(r.amount) * 100) : 0;
    out.valid.push(r);
  }
  if (currencies.size > 1) {
    const first = out.valid.find(r => MONEY_EVENTS.includes(r.event_type)).currency;
    out.valid = out.valid.filter(r => {
      if (MONEY_EVENTS.includes(r.event_type) && r.currency !== first) { out.quarantined.push({ row: r, reasons: ['currency ' + r.currency + ' differs from cohort currency ' + first] }); return false; }
      return true;
    });
  }
  out.currency = out.valid.find(r => MONEY_EVENTS.includes(r.event_type))?.currency || null;
  return out;
}

// ---------- cohort building ----------
export function buildCohort(validation, contract = DEFAULT_CONTRACT) {
  const events = [...validation.valid].sort((a, b) => a.t - b.t || a._line - b._line);
  const users = new Map();
  const quarantined = [];
  const flags = { crossoverUsers: new Set(), assignmentConflictUsers: new Set(), duplicateAssignments: 0, orphanEvents: 0 };
  for (const e of events) {
    if (e.event_type !== 'assigned') continue;
    const u = users.get(e.user_id);
    if (!u) {
      const exp = expectedVariant(e.user_id, e.assignment_seed);
      users.set(e.user_id, { id: e.user_id, variant: e.variant, seed: e.assignment_seed, source: e.acquisition_source, assignedAt: e.t, events: [], paidCents: 0, refundCents: 0 });
      if (exp !== e.variant) flags.assignmentConflictUsers.add(e.user_id);
    } else if (u.variant === e.variant) {
      flags.duplicateAssignments++;
    } else {
      flags.crossoverUsers.add(e.user_id);
    }
  }
  for (const e of events) {
    if (e.event_type === 'assigned') continue;
    const u = users.get(e.user_id);
    if (!u) { flags.orphanEvents++; quarantined.push({ row: e, reasons: ['event for user with no assignment row (incomplete export?)'] }); continue; }
    if (e.t < u.assignedAt) { quarantined.push({ row: e, reasons: ['event occurs before assignment'] }); continue; }
    if (e.variant !== u.variant) flags.crossoverUsers.add(e.user_id);
    if (e.event_type === 'paid') u.paidCents += e.amountValue;
    if (e.event_type === 'refunded') {
      if (e.amountValue > u.paidCents - u.refundCents) { quarantined.push({ row: e, reasons: ['refund exceeds prior payments for this user'] }); continue; }
      u.refundCents += e.amountValue;
    }
    if (e.event_type === 'task_completed' && !u.events.some(x => x.event_type === 'task_created' && x.task_id === e.task_id)) {
      quarantined.push({ row: e, reasons: ['task_completed for a task that was never created'] }); continue;
    }
    u.events.push(e);
  }
  const allT = events.map(e => e.t);
  const asOf = allT.length ? Math.max(...allT) : 0;
  const matureWindow = Math.max(contract.repeatWindowDays, contract.revenueWindowDays) * DAY;
  const list = [...users.values()].map(u => ({ ...u, mature: u.assignedAt + matureWindow <= asOf, outcomes: userOutcomes(u, contract) }));
  return { users: list, quarantined, flags, asOf, eventTypesPresent: new Set(events.map(e => e.event_type)) };
}

export function userOutcomes(u, contract = DEFAULT_CONTRACT) {
  const a = u.assignedAt;
  const ev = u.events;
  const inFirst = e => e.t - a < DAY;
  const noteSaved = ev.some(e => e.event_type === 'note_saved' && inFirst(e));
  const tasks = new Set(ev.filter(e => e.event_type === 'task_created' && inFirst(e)).map(e => e.task_id));
  const firstValue = noteSaved && tasks.size >= contract.firstValueMinTasks;
  const laterDay = e => e.t - a >= DAY && e.t - a < contract.repeatWindowDays * DAY;
  const revisitDays = new Set(ev.filter(e => e.event_type === 'revisited' && laterDay(e)).map(e => Math.floor((e.t - a) / DAY)));
  const completeDays = new Set(ev.filter(e => e.event_type === 'task_completed' && laterDay(e)).map(e => Math.floor((e.t - a) / DAY)));
  const repeatValue = [...revisitDays].some(d => completeDays.has(d));
  const inRev = e => e.t - a < contract.revenueWindowDays * DAY;
  const trial = ev.some(e => e.event_type === 'trial_started' && inRev(e));
  const paidEv = ev.filter(e => e.event_type === 'paid' && inRev(e));
  const refundEv = ev.filter(e => e.event_type === 'refunded' && inRev(e));
  const cancelled = ev.some(e => e.event_type === 'cancelled' && inRev(e));
  const paidCents = paidEv.reduce((s, e) => s + e.amountValue, 0);
  const refundCents = refundEv.reduce((s, e) => s + e.amountValue, 0);
  return { firstValue, repeatValue, trial, paid: paidEv.length > 0, refunded: refundEv.length > 0, cancelled, netCents: paidCents - refundCents };
}

// ---------- statistics ----------
export function rate(k, n) { return n > 0 ? k / n : null; }
export function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
export function diffCI(k1, n1, k0, n0, z = 1.96) {
  if (!n1 || !n0) return null;
  const p1 = k1 / n1, p0 = k0 / n0;
  const se = Math.sqrt(p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0);
  return { diff: p1 - p0, lo: p1 - p0 - z * se, hi: p1 - p0 + z * se };
}
function meanVar(xs) {
  if (!xs.length) return { mean: null, v: null };
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.length > 1 ? xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1) : 0;
  return { mean: m, v };
}

export const METRICS = [
  { key: 'firstValue', label: 'First value (hypothesis)', kind: 'rate' },
  { key: 'repeatValue', label: 'Seven-day repeat value (hypothesis, primary)', kind: 'rate' },
  { key: 'trial', label: 'Trial started', kind: 'rate' },
  { key: 'paid', label: 'Paid conversion', kind: 'rate' },
  { key: 'refunded', label: 'Refunded (share of eligible users)', kind: 'rate' },
  { key: 'cancelled', label: 'Cancelled (share of eligible users)', kind: 'rate' },
  { key: 'netCents', label: 'Net revenue per eligible user', kind: 'money' },
];

export function armSummary(users) {
  const n = users.length;
  const s = { n };
  for (const m of METRICS) {
    if (m.kind === 'rate') { const k = users.filter(u => u.outcomes[m.key]).length; s[m.key] = { k, n, rate: rate(k, n), ci: wilson(k, n) }; }
    else { const { mean, v } = meanVar(users.map(u => u.outcomes.netCents)); s[m.key] = { n, mean, v, total: users.reduce((t, u) => t + u.outcomes.netCents, 0) }; }
  }
  const payers = users.filter(u => u.outcomes.paid);
  const refundedPayers = payers.filter(u => u.outcomes.refunded).length;
  s.refundPerPayer = { k: refundedPayers, n: payers.length, rate: rate(refundedPayers, payers.length) };
  return s;
}

export function compare(t, b) {
  const out = {};
  for (const m of METRICS) {
    if (m.kind === 'rate') out[m.key] = diffCI(t[m.key].k, t[m.key].n, b[m.key].k, b[m.key].n);
    else if (t.n && b.n) {
      const d = t[m.key].mean - b[m.key].mean, se = Math.sqrt(t[m.key].v / t.n + b[m.key].v / b.n);
      out[m.key] = { diff: d, lo: d - 1.96 * se, hi: d + 1.96 * se };
    } else out[m.key] = null;
  }
  out.refundPerPayer = diffCI(t.refundPerPayer.k, t.refundPerPayer.n, b.refundPerPayer.k, b.refundPerPayer.n);
  return out;
}

export function srm(users) {
  const bySeed = new Map();
  for (const u of users) {
    if (!bySeed.has(u.seed)) bySeed.set(u.seed, { seed: u.seed, baseline: 0, task_first: 0 });
    bySeed.get(u.seed)[u.variant]++;
  }
  return [...bySeed.values()].map(g => {
    const p = parseSeed(g.seed).treatmentPercent / 100, n = g.baseline + g.task_first;
    const eT = n * p, eB = n * (1 - p);
    const chi = (eT ? (g.task_first - eT) ** 2 / eT : 0) + (eB ? (g.baseline - eB) ** 2 / eB : 0);
    return { ...g, n, expectedTreatmentShare: p, observedTreatmentShare: n ? g.task_first / n : null, chiSquare: chi };
  });
}

export function segments(users, metricKey) {
  const sources = [...new Set(users.map(u => u.source))].sort();
  const total = users.length;
  const rows = sources.map(src => {
    const su = users.filter(u => u.source === src);
    const t = su.filter(u => u.variant === 'task_first'), b = su.filter(u => u.variant === 'baseline');
    const kt = t.filter(u => u.outcomes[metricKey]).length, kb = b.filter(u => u.outcomes[metricKey]).length;
    return { source: src, pooledShare: su.length / total, nT: t.length, nB: b.length, kT: kt, kB: kb, rateT: rate(kt, t.length), rateB: rate(kb, b.length) };
  });
  const nT = rows.reduce((s, r) => s + r.nT, 0), nB = rows.reduce((s, r) => s + r.nB, 0);
  rows.forEach(r => { r.shareT = nT ? r.nT / nT : 0; r.shareB = nB ? r.nB / nB : 0; });
  const mixDistance = rows.reduce((s, r) => s + Math.abs(r.shareT - r.shareB), 0) / 2;
  const comparable = rows.filter(r => r.nT > 0 && r.nB > 0);
  const missingSegments = rows.filter(r => !(r.nT > 0 && r.nB > 0)).map(r => r.source);
  const w = comparable.reduce((s, r) => s + r.pooledShare, 0);
  let fixedT = null, fixedB = null;
  if (w > 0) {
    fixedT = comparable.reduce((s, r) => s + r.pooledShare * r.rateT, 0) / w;
    fixedB = comparable.reduce((s, r) => s + r.pooledShare * r.rateB, 0) / w;
  }
  const aggT = rate(rows.reduce((s, r) => s + r.kT, 0), nT), aggB = rate(rows.reduce((s, r) => s + r.kB, 0), nB);
  return { metricKey, rows, mixDistance, missingSegments, aggregate: { t: aggT, b: aggB, diff: aggT != null && aggB != null ? aggT - aggB : null }, fixedMix: { t: fixedT, b: fixedB, diff: fixedT != null ? fixedT - fixedB : null } };
}

function confounded(seg, contract) {
  const a = seg.aggregate.diff, f = seg.fixedMix.diff;
  if (a == null || f == null) return false;
  const signFlip = Math.abs(a) >= 0.01 && Math.sign(a) !== Math.sign(f) && Math.abs(f) >= 0.002;
  const vanishes = Math.abs(a) >= 0.01 && Math.abs(f) < Math.abs(a) / 2;
  return seg.mixDistance >= contract.confoundMixDistance && (signFlip || vanishes);
}

// ---------- decision ----------
const pp = x => (x * 100).toFixed(1) + ' pp';

export function analyze(text, contractIn = {}) {
  const contract = { ...DEFAULT_CONTRACT, ...contractIn };
  const validation = validate(text);
  const gates = [];
  const warnings = [];
  const guardrails = [];
  if (validation.headerErrors.length) {
    gates.push({ id: 'schema', pass: false, detail: 'CSV schema invalid: ' + validation.headerErrors.join('; ') });
    return finish({ contract, validation, cohort: null, gates, guardrails, warnings });
  }
  const cohort = buildCohort(validation, contract);
  const allQ = validation.quarantined.length + cohort.quarantined.length;
  const qShare = validation.totalRows ? allQ / validation.totalRows : 0;
  gates.push({ id: 'quality', pass: qShare <= contract.maxQuarantineShare, detail: `${allQ} of ${validation.totalRows} rows quarantined (${(qShare * 100).toFixed(1)}%; limit ${(contract.maxQuarantineShare * 100).toFixed(0)}%). ${validation.duplicatesRemoved} exact duplicate rows counted once.` });
  const orphanShare = validation.totalRows ? cohort.flags.orphanEvents / validation.totalRows : 0;
  gates.push({ id: 'complete', pass: orphanShare <= contract.maxOrphanShare, detail: `${cohort.flags.orphanEvents} events belong to users with no assignment row (${(orphanShare * 100).toFixed(1)}%; limit ${(contract.maxOrphanShare * 100).toFixed(0)}%). A high share means the export is incomplete or filtered.` });
  const requiredTypes = ['assigned', 'note_saved', 'task_created', 'revisited', 'task_completed', 'trial_started', 'paid', 'refunded', 'cancelled'];
  const absent = requiredTypes.filter(t => !cohort.eventTypesPresent.has(t));
  gates.push({ id: 'events', pass: absent.length === 0, detail: absent.length ? `Event types never present: ${absent.join(', ')}. Revenue or refund guardrails cannot be evaluated.` : 'All nine contract event types present.' });
  const nUsers = cohort.users.length;
  const conflictShare = nUsers ? cohort.flags.assignmentConflictUsers.size / nUsers : 0;
  const crossShare = nUsers ? cohort.flags.crossoverUsers.size / nUsers : 0;
  gates.push({ id: 'assignment', pass: conflictShare <= contract.maxAssignmentIssueShare && crossShare <= contract.maxAssignmentIssueShare, detail: `${cohort.flags.assignmentConflictUsers.size} users whose recorded variant disagrees with the stable hash of assignment_seed, ${cohort.flags.crossoverUsers.size} users seen in both variants (limit ${(contract.maxAssignmentIssueShare * 100).toFixed(0)}% each). ${cohort.flags.duplicateAssignments} duplicate assignment rows counted once.` });
  const srmRows = srm(cohort.users);
  const srmBad = srmRows.filter(r => r.chiSquare > contract.srmChiSquareThreshold);
  gates.push({ id: 'srm', pass: srmBad.length === 0, detail: srmRows.map(r => `${r.seed}: ${r.task_first} task-first / ${r.baseline} baseline, expected ${(r.expectedTreatmentShare * 100).toFixed(0)}% task-first, observed ${r.observedTreatmentShare == null ? 'n/a' : (r.observedTreatmentShare * 100).toFixed(1) + '%'}, chi-square ${r.chiSquare.toFixed(2)} (limit ${contract.srmChiSquareThreshold})`).join('; ') || 'No assigned users.' });
  const mature = cohort.users.filter(u => u.mature);
  const immatureShare = nUsers ? 1 - mature.length / nUsers : 0;
  gates.push({ id: 'maturity', pass: nUsers > 0 && immatureShare <= contract.maxImmatureShare, detail: `${nUsers - mature.length} of ${nUsers} assigned users have not completed the ${Math.max(contract.repeatWindowDays, contract.revenueWindowDays)}-day window as of ${cohort.asOf ? new Date(cohort.asOf).toISOString().slice(0, 10) : 'n/a'} (${(immatureShare * 100).toFixed(1)}%; limit ${(contract.maxImmatureShare * 100).toFixed(0)}%). Immature users are excluded from outcomes.` });
  const T = mature.filter(u => u.variant === 'task_first'), B = mature.filter(u => u.variant === 'baseline');
  gates.push({ id: 'sample', pass: T.length >= contract.minMatureUsersPerArm && B.length >= contract.minMatureUsersPerArm, detail: `Mature eligible users: task-first ${T.length}, baseline ${B.length} (pre-registered minimum ${contract.minMatureUsersPerArm} per arm).${!T.length || !B.length ? ' An arm has zero users, so rates have a zero denominator and are reported as n/a.' : ''}` });
  const arms = { task_first: armSummary(T), baseline: armSummary(B) };
  const diffs = compare(arms.task_first, arms.baseline);
  const segs = {};
  for (const k of ['repeatValue', 'trial', 'paid', 'firstValue']) segs[k] = segments(mature, k);
  for (const k of ['repeatValue', 'trial', 'paid']) {
    const s = segs[k];
    if (confounded(s, contract)) warnings.push({ id: 'mix-' + k, metric: k, detail: `Acquisition-mix confounding on ${METRICS.find(m => m.key === k).label.toLowerCase()}: the arms' source mix differs by ${(s.mixDistance * 100).toFixed(0)}% (total variation). The aggregate difference is ${pp(s.aggregate.diff)}, but the fixed-mix difference (each arm weighted to the pooled source mix) is ${pp(s.fixedMix.diff)}. The headline lift comes from who entered each arm, not from the journey.` });
    if (s.missingSegments.length) warnings.push({ id: 'seg-missing-' + k, metric: k, detail: `Sources present in only one arm and excluded from the fixed-mix comparison: ${s.missingSegments.join(', ')}.` });
  }
  if (T.length && B.length) {
    const rv = diffs.repeatValue;
    guardrails.push({ id: 'repeat', pass: rv.diff > -contract.guardrailRepeatDropPp / 100, detail: `Seven-day repeat value change ${pp(rv.diff)} (fails if below -${contract.guardrailRepeatDropPp} pp).` });
    const rf = diffs.refunded, rp = arms;
    guardrails.push({ id: 'refund', pass: rf.diff <= contract.guardrailRefundRisePp / 100, detail: `Refunded users per eligible user change ${pp(rf.diff)} (task-first ${rp.task_first.refunded.k}/${rp.task_first.refunded.n}, baseline ${rp.baseline.refunded.k}/${rp.baseline.refunded.n}; fails above +${contract.guardrailRefundRisePp} pp). Refunds per payer, shown for context only: task-first ${rp.task_first.refundPerPayer.k}/${rp.task_first.refundPerPayer.n}, baseline ${rp.baseline.refundPerPayer.k}/${rp.baseline.refundPerPayer.n}.` });
    const cc = diffs.cancelled;
    guardrails.push({ id: 'cancel', pass: cc.diff <= contract.guardrailCancelRisePp / 100, detail: `Cancellation change ${pp(cc.diff)} (fails above +${contract.guardrailCancelRisePp} pp).` });
    const nr = diffs.netCents;
    const negArm = ['task_first', 'baseline'].filter(a => arms[a].netCents.total < 0);
    guardrails.push({ id: 'net', pass: nr.diff >= 0 && negArm.length === 0, detail: `Net revenue per eligible user change ${money(nr.diff, validation.currency)} (task-first ${money(arms.task_first.netCents.mean, validation.currency)}, baseline ${money(arms.baseline.netCents.mean, validation.currency)}).${negArm.length ? ' Negative total net revenue in: ' + negArm.join(', ') + '.' : ''} Fails if lower than baseline.` });
  }
  return finish({ contract, validation, cohort, gates, guardrails, warnings, arms, diffs, segments: segs, srm: srmRows, matureCounts: { task_first: T.length, baseline: B.length } });
}

export function money(cents, currency) {
  if (cents == null || Number.isNaN(cents)) return 'n/a';
  return (cents < 0 ? '-' : '') + (currency || '') + ' ' + (Math.abs(cents) / 100).toFixed(2);
}

function finish(r) {
  const failedGates = r.gates.filter(g => !g.pass);
  const failedGuards = r.guardrails.filter(g => !g.pass);
  let decision, reasons;
  if (failedGates.length) {
    decision = 'NO_DECISION';
    reasons = failedGates.map(g => g.detail);
  } else if (failedGuards.length) {
    decision = 'REJECT';
    reasons = failedGuards.map(g => g.detail);
  } else {
    const k = r.contract.primaryMetric;
    const fixed = r.segments[k].fixedMix;
    const mixWarn = r.warnings.find(w => w.id === 'mix-' + k || w.id === 'mix-trial' || w.id === 'mix-paid');
    const d = r.diffs[k];
    if (mixWarn) { decision = 'ITERATE'; reasons = [mixWarn.detail, 'Do not scale on the aggregate. Re-run with balanced traffic, or stratify assignment by acquisition source.']; }
    else if (d.lo > 0 && fixed.diff > 0) { decision = 'SCALE'; reasons = [`Primary metric improved by ${pp(d.diff)} (95% interval ${pp(d.lo)} to ${pp(d.hi)}), the fixed-mix difference agrees (${pp(fixed.diff)}), and every guardrail held.`, 'Scale means the next ramp step with the same guardrails monitored, not an immediate 100% launch.']; }
    else { decision = 'ITERATE'; reasons = [`Primary metric change ${pp(d.diff)} (95% interval ${pp(d.lo)} to ${pp(d.hi)}) does not clear zero. No guardrail failed, but there is no evidence of a repeat-value gain.`]; }
  }
  return { ...r, decision, reasons };
}

// ---------- memo ----------
export function memo(r, meta = {}) {
  const L = [];
  const c = r.contract, cur = r.validation.currency;
  const pct = x => x == null ? 'n/a' : (x * 100).toFixed(1) + '%';
  L.push('# Evidence memo: Evernote Habit-to-Value Studio');
  L.push('');
  L.push('Independent concept by Ayo Ahmed. Synthetic data only. Not affiliated with Evernote or Bending Spoons. No real users, analytics, or revenue.');
  L.push('');
  L.push(`- Dataset: ${meta.name || 'imported CSV'}`);
  L.push(`- Generated: ${meta.generatedAt || new Date().toISOString()}`);
  L.push(`- Data as of: ${r.cohort?.asOf ? new Date(r.cohort.asOf).toISOString() : 'n/a'}`);
  L.push('');
  L.push(`## Decision: ${r.decision.replace('_', ' ')}`);
  r.reasons.forEach(x => L.push('- ' + x));
  L.push('');
  L.push('## Metric contract (pre-registered, provisional hypotheses, not Evernote KPIs)');
  L.push(`- Randomisation unit: user. Denominator: intent-to-treat, every mature assigned user counted once from the assignment row.`);
  L.push(`- Assignment: stable FNV-1a hash of "assignment_seed|user_id" mod 100 is compared with the treatment percentage in the seed.`);
  L.push(`- First value: note saved and at least ${c.firstValueMinTasks} task created within 24 h of assignment.`);
  L.push(`- Repeat value (primary): a revisit and a task completion on the same later day, from day 1 to before day ${c.repeatWindowDays}.`);
  L.push(`- Trial and paid conversion are reported separately. Net revenue = paid minus refunds within ${c.revenueWindowDays} days, divided by eligible assigned users. Synthetic prices. Not lifetime value.`);
  L.push(`- Minimum sample: ${c.minMatureUsersPerArm} mature users per arm. Guardrails: repeat value no worse than -${c.guardrailRepeatDropPp} pp; refunded share of eligible users and cancellation no worse than +${c.guardrailRefundRisePp} / +${c.guardrailCancelRisePp} pp; net revenue per user not lower.`);
  L.push('');
  L.push('## Quality gates');
  r.gates.forEach(g => L.push(`- [${g.pass ? 'pass' : 'FAIL'}] ${g.id}: ${g.detail}`));
  if (r.arms) {
    L.push('');
    L.push('## Results (mature users)');
    L.push('| Metric | Task-first | Baseline | Difference (95% interval) |');
    L.push('|---|---|---|---|');
    for (const m of METRICS) {
      const t = r.arms.task_first[m.key], b = r.arms.baseline[m.key], d = r.diffs[m.key];
      if (m.kind === 'rate') L.push(`| ${m.label} | ${t.k}/${t.n} (${pct(t.rate)}) | ${b.k}/${b.n} (${pct(b.rate)}) | ${d ? pp(d.diff) + ' (' + pp(d.lo) + ' to ' + pp(d.hi) + ')' : 'n/a'} |`);
      else L.push(`| ${m.label} | ${money(t.mean, cur)} (n=${t.n}) | ${money(b.mean, cur)} (n=${b.n}) | ${d ? money(d.diff, cur) + ' (' + money(d.lo, cur) + ' to ' + money(d.hi, cur) + ')' : 'n/a'} |`);
    }
    L.push('');
    L.push('## Guardrails');
    r.guardrails.forEach(g => L.push(`- [${g.pass ? 'pass' : 'FAIL'}] ${g.detail}`));
    L.push('');
    L.push('## Acquisition-source segments (repeat value, then trial)');
    for (const k of ['repeatValue', 'trial']) {
      const s = r.segments[k];
      L.push(`### ${METRICS.find(m => m.key === k).label}`);
      L.push('| Source | Task-first k/n | Baseline k/n | Pooled share |');
      L.push('|---|---|---|---|');
      s.rows.forEach(x => L.push(`| ${x.source} | ${x.kT}/${x.nT} (${pct(x.rateT)}) | ${x.kB}/${x.nB} (${pct(x.rateB)}) | ${pct(x.pooledShare)} |`));
      L.push(`Aggregate difference ${s.aggregate.diff == null ? 'n/a' : pp(s.aggregate.diff)}; fixed-mix difference ${s.fixedMix.diff == null ? 'n/a' : pp(s.fixedMix.diff)}; mix distance ${(s.mixDistance * 100).toFixed(0)}%.`);
      L.push('');
    }
  }
  if (r.warnings.length) { L.push('## Warnings'); r.warnings.forEach(w => L.push('- ' + w.detail)); L.push(''); }
  const q = [...r.validation.quarantined, ...(r.cohort?.quarantined || [])];
  L.push(`## Quarantined rows (${q.length})`);
  q.slice(0, 25).forEach(x => L.push(`- line ${x.row._line}: ${x.reasons.join('; ')}`));
  if (q.length > 25) L.push(`- ...and ${q.length - 25} more`);
  L.push('');
  L.push('## Limitations');
  L.push('- Synthetic seeded data. These results say nothing about real Evernote users.');
  L.push('- Intervals are normal-approximation 95% intervals for a single pre-registered comparison, with no correction for multiple metrics. Treat them as descriptive.');
  L.push('- Net revenue over a fixed short window is not lifetime value. Refunds outside the window are not observed.');
  L.push('- Repeat value is a hypothesis proxy for habit. It still needs to be validated against long-term retained paid use.');
  return L.join('\n') + '\n';
}
