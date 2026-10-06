// Deterministic synthetic cohort generator. Run: npm run fixtures
import { writeFileSync } from 'node:fs';
import { expectedVariant, toCSV } from '../public/engine.js';

const DAY = 86400000, MIN = 60000;
const START = Date.parse('2026-08-03T09:00:00Z');
const iso = t => new Date(t).toISOString().replace('.000Z', 'Z');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, weights) => { let x = r() * weights.reduce((s, [, w]) => s + w, 0); for (const [k, w] of weights) { if ((x -= w) < 0) return k; } return weights[weights.length - 1][0]; };

// p(variant, source) -> probabilities
function genUsers({ name, seedNum, phases, probs, extractDay, price = '10.00', currency = 'XTS', skipTypes = [] }) {
  const r = rng(seedNum);
  const rows = [];
  let ev = 0, uid = 0;
  const add = (u, type, t, extra = {}) => { if (skipTypes.includes(type)) return; rows.push({ event_id: `${name}-e${String(++ev).padStart(6, '0')}`, user_id: u.id, variant: u.variant, assignment_seed: u.seed, acquisition_source: u.source, event_type: type, occurred_at: iso(t), amount: '', currency: '', note_id: '', task_id: '', ...extra }); };
  for (const ph of phases) {
    for (let i = 0; i < ph.users; i++) {
      const id = `${name}-u${String(++uid).padStart(5, '0')}`;
      const source = pick(r, ph.mix);
      const variant = expectedVariant(id, ph.seed);
      const a = START + Math.floor((ph.dayFrom + r() * (ph.dayTo - ph.dayFrom)) * DAY);
      const u = { id, variant, seed: ph.seed, source };
      const p = probs(variant, source);
      add(u, 'assigned', a);
      const note = `n-${id}`;
      let tasks = [];
      if (r() < p.note) {
        add(u, 'note_saved', a + 4 * MIN, { note_id: note });
        if (r() < p.task) {
          const k = 1 + Math.floor(r() * 3);
          for (let j = 1; j <= k; j++) { const tid = `t-${id}-${j}`; tasks.push(tid); add(u, 'task_created', a + (5 + j) * MIN, { note_id: note, task_id: tid }); }
        }
      }
      if (tasks.length && r() < p.repeat) {
        const d = 1 + Math.floor(r() * 5);
        add(u, 'revisited', a + d * DAY + 30 * MIN, { note_id: note });
        add(u, 'task_completed', a + d * DAY + 35 * MIN, { note_id: note, task_id: tasks[0] });
      } else if (r() < 0.25) {
        add(u, 'revisited', a + (1 + Math.floor(r() * 5)) * DAY, { note_id: note });
      }
      if (r() < p.trial) {
        const td = Math.floor(r() * 4);
        add(u, 'trial_started', a + td * DAY + 60 * MIN);
        if (r() < p.paid) {
          const pt = a + (td + 7) * DAY + 60 * MIN;
          add(u, 'paid', pt, { amount: price, currency });
          if (r() < p.refund) add(u, 'refunded', pt + 2 * DAY, { amount: price, currency });
          if (r() < p.cancel) add(u, 'cancelled', pt + 3 * DAY);
        }
      }
    }
  }
  // extract marker: one late baseline event fixes "data as of" deterministically
  return { rows, extractAt: START + extractDay * DAY };
}

const finalize = (rows, extractAt) => rows.filter(x => Date.parse(x.occurred_at) <= extractAt).sort((x, y) => x.occurred_at < y.occurred_at ? -1 : x.occurred_at > y.occurred_at ? 1 : x.event_id < y.event_id ? -1 : 1);
const MIX = [['organic_search', 35], ['paid_social', 30], ['app_store', 20], ['referral', 15]];
const lift = (base, v, d) => Math.min(0.98, base + (v === 'task_first' ? d : 0));

// 1. Healthy: task-first improves repeat value in every source; guardrails hold. Includes a few dirty rows.
{
  const q = { organic_search: 1.1, paid_social: 0.75, app_store: 1, referral: 1.25 };
  const { rows, extractAt } = genUsers({ name: 'hv1', seedNum: 11, extractDay: 45, phases: [{ seed: 'hv1:main:50', users: 1000, dayFrom: 0, dayTo: 21, mix: MIX }],
    probs: (v, s) => ({ note: 0.82, task: lift(0.45, v, 0.2), repeat: lift(0.35 * q[s], v, 0.12), trial: lift(0.24 * q[s], v, 0.03), paid: 0.55, refund: 0.08, cancel: 0.1 }) });
  const out = finalize(rows, extractAt);
  out.push({ ...out[10] }, { ...out[200] }, { ...out[400] });                                    // exact duplicates
  out.push({ ...out[50], event_id: 'hv1-bad-1', event_type: 'paid', amount: '10,00', currency: 'XTS' }); // malformed money
  out.push({ ...out[60], event_id: 'hv1-bad-2', occurred_at: '2026-13-41 25:00' });              // malformed timestamp
  const payer = out.find(x => x.event_type === 'paid');
  out.push({ ...payer, event_id: 'hv1-bad-3', event_type: 'refunded', amount: '99.00', occurred_at: iso(Date.parse(payer.occurred_at) + DAY) }); // refund > paid
  writeFileSync('public/fixtures/healthy.csv', toCSV(out));
}
// 2. Simpson: ramp phases with different allocations meet different traffic mixes. No within-source effect.
{
  const rep = { organic_search: 0.42, paid_social: 0.12, app_store: 0.3, referral: 0.5 };
  const tri = { organic_search: 0.2, paid_social: 0.05, app_store: 0.12, referral: 0.24 };
  const { rows, extractAt } = genUsers({ name: 'hv2', seedNum: 22, extractDay: 45, phases: [
    { seed: 'hv2:ramp20:20', users: 520, dayFrom: 0, dayTo: 10, mix: [['paid_social', 70], ['app_store', 15], ['organic_search', 10], ['referral', 5]] },
    { seed: 'hv2:ramp80:80', users: 520, dayFrom: 10, dayTo: 21, mix: [['organic_search', 45], ['referral', 30], ['app_store', 15], ['paid_social', 10]] }],
    probs: (v, s) => ({ note: 0.85, task: 0.7, repeat: rep[s] - (v === 'task_first' ? 0.06 : 0), trial: tri[s] - (v === 'task_first' ? 0.02 : 0), paid: 0.45, refund: 0.08, cancel: 0.1 }) });
  writeFileSync('public/fixtures/simpson.csv', toCSV(finalize(rows, extractAt)));
}
// 3. Conversion up, refunds up, repeat value down: must be rejected.
{
  const { rows, extractAt } = genUsers({ name: 'hv3', seedNum: 33, extractDay: 45, phases: [{ seed: 'hv3:main:50', users: 1100, dayFrom: 0, dayTo: 21, mix: MIX }],
    probs: v => v === 'task_first'
      ? { note: 0.8, task: 0.5, repeat: 0.16, trial: 0.24, paid: 0.5, refund: 0.6, cancel: 0.3 }
      : { note: 0.8, task: 0.5, repeat: 0.33, trial: 0.16, paid: 0.48, refund: 0.08, cancel: 0.1 } });
  writeFileSync('public/fixtures/guardrail.csv', toCSV(finalize(rows, extractAt)));
}
// 4. Biased/incomplete: recent cohort, refund events missing from the export, baseline assignment rows dropped, crossover.
{
  const { rows, extractAt } = genUsers({ name: 'hv4', seedNum: 44, extractDay: 40, skipTypes: ['refunded'], phases: [{ seed: 'hv4:main:50', users: 420, dayFrom: 24, dayTo: 39, mix: MIX }],
    probs: v => ({ note: 0.8, task: lift(0.5, v, 0.1), repeat: lift(0.3, v, 0.1), trial: lift(0.15, v, 0.04), paid: 0.45, refund: 0.1, cancel: 0.1 }) });
  let out = finalize(rows, extractAt);
  const r = rng(4);
  const dropped = new Set(out.filter(x => x.event_type === 'assigned' && x.variant === 'baseline' && r() < 0.35).map(x => x.event_id));
  out = out.filter(x => !dropped.has(x.event_id));
  const tf = out.filter(x => x.variant === 'task_first' && x.event_type === 'note_saved').slice(0, 12);
  tf.forEach((x, i) => out.push({ ...x, event_id: `hv4-x${i}`, variant: 'baseline', event_type: 'revisited', occurred_at: iso(Date.parse(x.occurred_at) + DAY) }));
  out.push({ ...out[5] }, { ...out[6] });
  out.push({ ...out[7], event_id: 'hv4-bad-1', amount: '-5.00', event_type: 'paid', currency: 'XTS' });
  writeFileSync('public/fixtures/biased.csv', toCSV(out));
}
console.log('fixtures written');
