import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-ignore plain ES module shared with the browser
import * as Engine from '../public/engine.js';
const E: any = Engine;

const fx = (n: string): string => readFileSync(`public/fixtures/${n}.csv`, 'utf8') as string;
const H = E.FIELDS.join(',');
const row = (o: Record<string, string>) => E.FIELDS.map((f: string) => o[f] ?? '').join(',');
const base = { variant: 'baseline', assignment_seed: 'hv9:main:50', acquisition_source: 'organic_search' };
function userRows(id: string, start = '2026-08-01T10:00:00Z') {
  const variant = E.expectedVariant(id, base.assignment_seed);
  return [row({ ...base, variant, event_id: id + '-a', user_id: id, event_type: 'assigned', occurred_at: start })];
}

describe('seeded scenarios', () => {
  it('healthy cohort scales only to the next ramp step', () => {
    const r = E.analyze(fx('healthy'));
    expect(r.decision).toBe('SCALE');
    expect(r.gates.every((g: any) => g.pass)).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/next ramp step/);
  });
  it('Simpson acquisition-mix reversal yields ITERATE with fixed-mix warning', () => {
    const r = E.analyze(fx('simpson'));
    expect(r.decision).toBe('ITERATE');
    const s = r.segments.repeatValue;
    expect(s.aggregate.diff).toBeGreaterThan(0.02);
    expect(s.fixedMix.diff).toBeLessThan(0);
    expect(s.mixDistance).toBeGreaterThan(0.1);
    expect(r.warnings.some((w: any) => w.id === 'mix-repeatValue')).toBe(true);
  });
  it('conversion up but refunds up and repeat value down is rejected', () => {
    const r = E.analyze(fx('guardrail'));
    expect(r.diffs.trial.diff).toBeGreaterThan(0);
    expect(r.diffs.paid.diff).toBeGreaterThan(0);
    expect(r.decision).toBe('REJECT');
    const failed = r.guardrails.filter((g: any) => !g.pass).map((g: any) => g.id);
    expect(failed).toEqual(expect.arrayContaining(['repeat', 'refund', 'net']));
  });
  it('biased incomplete cohort refuses to call a winner and names each reason', () => {
    const r = E.analyze(fx('biased'));
    expect(r.decision).toBe('NO_DECISION');
    const failed = r.gates.filter((g: any) => !g.pass).map((g: any) => g.id);
    expect(failed).toEqual(expect.arrayContaining(['quality', 'complete', 'events', 'assignment', 'srm', 'maturity', 'sample']));
    expect(r.reasons.join(' ')).toMatch(/Event types never present: refunded/);
  });
});

describe('validation', () => {
  it('rejects a CSV with missing columns', () => {
    const r = E.analyze('event_id,user_id\n1,2\n');
    expect(r.decision).toBe('NO_DECISION');
    expect(r.reasons[0]).toMatch(/missing columns/);
  });
  it('counts exact duplicate events once and quarantines conflicting event_id reuse', () => {
    const a = userRows('dup-1')[0];
    const v = E.validate([H, a, a, a.replace('organic_search', 'referral')].join('\n'));
    expect(v.valid).toHaveLength(1);
    expect(v.duplicatesRemoved).toBe(1);
    expect(v.quarantined[0].reasons[0]).toMatch(/reused with different content/);
  });
  it('quarantines malformed money and timestamps', () => {
    const id = 'm-1', variant = E.expectedVariant(id, base.assignment_seed);
    const csv = [H,
      row({ ...base, variant, event_id: 'x1', user_id: id, event_type: 'paid', occurred_at: '2026-08-02T10:00:00Z', amount: '"10,00"', currency: 'XTS' }),
      row({ ...base, variant, event_id: 'x2', user_id: id, event_type: 'paid', occurred_at: '2026-08-02T10:00:00Z', amount: '-1.00', currency: 'XTS' }),
      row({ ...base, variant, event_id: 'x3', user_id: id, event_type: 'paid', occurred_at: '2026-08-02T10:00:00Z', amount: '10.00', currency: '' }),
      row({ ...base, variant, event_id: 'x4', user_id: id, event_type: 'note_saved', occurred_at: '2026/08/02 10:00', note_id: 'n' }),
      row({ ...base, variant, event_id: 'x5', user_id: id, event_type: 'revisited', occurred_at: '2026-08-02T10:00:00Z', amount: '5.00' }),
    ].join('\n');
    const v = E.validate(csv);
    expect(v.valid).toHaveLength(0);
    const reasons = v.quarantined.map((q: any) => q.reasons.join(';'));
    expect(reasons[0]).toMatch(/amount/); expect(reasons[1]).toMatch(/non-positive/); expect(reasons[2]).toMatch(/currency/);
    expect(reasons[3]).toMatch(/timestamp/); expect(reasons[4]).toMatch(/non-money/);
  });
  it('quarantines refunds without prior payment and refunds larger than payments', () => {
    const id = 'r-1', variant = E.expectedVariant(id, base.assignment_seed);
    const m = { ...base, variant, user_id: id, currency: 'XTS' };
    const csv = [H, ...userRows(id),
      row({ ...m, event_id: 'r0', event_type: 'refunded', occurred_at: '2026-08-02T10:00:00Z', amount: '5.00' }),
      row({ ...m, event_id: 'r1', event_type: 'paid', occurred_at: '2026-08-03T10:00:00Z', amount: '10.00' }),
      row({ ...m, event_id: 'r2', event_type: 'refunded', occurred_at: '2026-08-04T10:00:00Z', amount: '11.00' }),
      row({ ...m, event_id: 'r3', event_type: 'refunded', occurred_at: '2026-08-05T10:00:00Z', amount: '10.00' }),
    ].join('\n');
    const c = E.buildCohort(E.validate(csv));
    expect(c.quarantined.map((q: any) => q.row.event_id)).toEqual(['r0', 'r2']);
    expect(c.users[0].outcomes.netCents).toBe(0);
  });
  it('quarantines mixed currencies against the cohort currency', () => {
    const id = 'c-1', variant = E.expectedVariant(id, base.assignment_seed);
    const m = { ...base, variant, user_id: id, event_type: 'paid', occurred_at: '2026-08-03T10:00:00Z', amount: '10.00' };
    const v = E.validate([H, row({ ...m, event_id: 'c1', currency: 'XTS' }), row({ ...m, event_id: 'c2', currency: 'EUR' })].join('\n'));
    expect(v.valid).toHaveLength(1);
    expect(v.quarantined[0].reasons[0]).toMatch(/differs from cohort currency/);
  });
});

describe('assignment and denominators', () => {
  it('stable assignment is deterministic and respects the seed percentage', () => {
    expect(E.expectedVariant('u1', 'a:b:50')).toBe(E.expectedVariant('u1', 'a:b:50'));
    const n = 4000; let t = 0;
    for (let i = 0; i < n; i++) if (E.expectedVariant('u' + i, 'a:b:20') === 'task_first') t++;
    expect(t / n).toBeGreaterThan(0.17); expect(t / n).toBeLessThan(0.23);
    expect(E.parseSeed('bad')).toBeNull(); expect(E.parseSeed('a:b:0')).toBeNull();
  });
  it('flags variant crossover and assignment conflicts, and counts users once', () => {
    const id = 'x-1', variant = E.expectedVariant(id, base.assignment_seed);
    const other = variant === 'baseline' ? 'task_first' : 'baseline';
    const csv = [H, ...userRows(id),
      row({ ...base, variant: other, event_id: 'x-a2', user_id: id, event_type: 'assigned', occurred_at: '2026-08-01T11:00:00Z' }),
      row({ ...base, variant, event_id: 'x-n', user_id: id, event_type: 'note_saved', occurred_at: '2026-08-01T11:00:00Z', note_id: 'n1' }),
      row({ ...base, variant, event_id: 'x-n2', user_id: id, event_type: 'note_saved', occurred_at: '2026-08-01T11:05:00Z', note_id: 'n1' }),
      row({ ...base, variant: other, event_id: 'y-a', user_id: 'y-1', event_type: 'assigned', occurred_at: '2026-08-01T10:00:00Z' }),
    ].join('\n');
    const c = E.buildCohort(E.validate(csv));
    expect(c.users).toHaveLength(2);
    expect(c.flags.crossoverUsers.has(id)).toBe(true);
    const yExpected = E.expectedVariant('y-1', base.assignment_seed);
    expect(c.flags.assignmentConflictUsers.has('y-1')).toBe(yExpected !== other);
  });
  it('quarantines orphan events and events before assignment', () => {
    const id = 'o-1', variant = E.expectedVariant(id, base.assignment_seed);
    const csv = [H, ...userRows(id, '2026-08-02T10:00:00Z'),
      row({ ...base, variant, event_id: 'o-early', user_id: id, event_type: 'revisited', occurred_at: '2026-08-01T10:00:00Z' }),
      row({ ...base, variant, event_id: 'o-orphan', user_id: 'nobody', event_type: 'revisited', occurred_at: '2026-08-03T10:00:00Z' }),
    ].join('\n');
    const c = E.buildCohort(E.validate(csv));
    expect(c.flags.orphanEvents).toBe(1);
    expect(c.quarantined.map((q: any) => q.reasons[0])).toEqual(expect.arrayContaining([expect.stringMatching(/before assignment/), expect.stringMatching(/no assignment row/)]));
  });
  it('zero denominators produce n/a rather than NaN and block a decision', () => {
    const csv = [H, ...userRows('z-1')].join('\n');
    const r = E.analyze(csv);
    expect(r.decision).toBe('NO_DECISION');
    expect(E.rate(0, 0)).toBeNull(); expect(E.wilson(0, 0)).toBeNull(); expect(E.diffCI(1, 2, 0, 0)).toBeNull();
    const arm = E.armSummary([]);
    expect(arm.repeatValue.rate).toBeNull();
    expect(E.money(null, 'XTS')).toBe('n/a');
  });
  it('immature cohort blocks a decision', () => {
    const t = fx('healthy');
    const r = E.analyze(t, { revenueWindowDays: 40 });
    expect(r.decision).toBe('NO_DECISION');
    expect(r.gates.find((g: any) => g.id === 'maturity').pass).toBe(false);
  });
  it('low sample size blocks a decision', () => {
    const r = E.analyze(fx('healthy'), { minMatureUsersPerArm: 5000 });
    expect(r.decision).toBe('NO_DECISION');
    expect(r.reasons.join(' ')).toMatch(/pre-registered minimum 5000/);
  });
  it('sample-ratio mismatch blocks a decision even with good outcomes', () => {
    const lines = fx('healthy').trim().split('\n');
    const keep = [lines[0], ...lines.slice(1).filter((l: string) => !(l.includes(',baseline,') && l.includes(',assigned,') && Number.parseInt(l.split(',')[1].slice(-2), 10) % 3 === 0))];
    const r = E.analyze(keep.join('\n'));
    expect(r.gates.find((g: any) => g.id === 'srm').pass).toBe(false);
    expect(r.decision).toBe('NO_DECISION');
  });
});

describe('outcomes and money', () => {
  it('repeat value requires a later-day revisit and completion on the same day within the window', () => {
    const u = { assignedAt: Date.parse('2026-08-01T10:00:00Z'), events: [] as any[] };
    const ev = (type: string, iso: string, extra: any = {}) => ({ event_type: type, t: Date.parse(iso), amountValue: 0, ...extra });
    u.events = [ev('note_saved', '2026-08-01T10:05:00Z'), ev('task_created', '2026-08-01T10:06:00Z', { task_id: 't1' }), ev('revisited', '2026-08-01T12:00:00Z'), ev('task_completed', '2026-08-01T12:01:00Z', { task_id: 't1' })];
    let o = E.userOutcomes(u);
    expect(o.firstValue).toBe(true); expect(o.repeatValue).toBe(false);
    u.events.push(ev('revisited', '2026-08-09T12:00:00Z'), ev('task_completed', '2026-08-09T12:01:00Z', { task_id: 't1' }));
    expect(E.userOutcomes(u).repeatValue).toBe(false);
    u.events.push(ev('revisited', '2026-08-03T12:00:00Z'), ev('task_completed', '2026-08-03T12:01:00Z', { task_id: 't1' }));
    expect(E.userOutcomes(u).repeatValue).toBe(true);
    expect(E.userOutcomes(u, { ...E.DEFAULT_CONTRACT, firstValueMinTasks: 2 }).firstValue).toBe(false);
  });
  it('net revenue guardrail fails when an arm has negative net revenue', () => {
    const r = E.analyze(fx('guardrail'));
    const g = r.guardrails.find((x: any) => x.id === 'net');
    expect(g.pass).toBe(false);
    expect(E.money(-150, 'XTS')).toBe('-XTS 1.50');
  });
  it('memo contains contract, gates, decision and limitations without fabricated claims', () => {
    const m = E.memo(E.analyze(fx('simpson')), { name: 'simpson.csv', generatedAt: '2026-10-06T00:00:00Z' });
    for (const s of ['## Decision: ITERATE', '## Metric contract', '## Quality gates', '## Guardrails', '## Limitations', 'fixed-mix difference', 'Synthetic']) expect(m).toContain(s);
    expect(m).not.toMatch(/p-value|ROI|lifetime value is/i);
  });
  it('CSV round trip handles quotes and commas', () => {
    const csv = E.toCSV([{ event_id: 'a', note_id: 'x,"y"' }]);
    const back = E.parseCSV(csv);
    expect(back[1][E.FIELDS.indexOf('note_id')]).toBe('x,"y"');
  });
});
