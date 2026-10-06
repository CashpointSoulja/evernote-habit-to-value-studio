import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const V = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const segs = JSON.parse(readFileSync(V + '/segments.json', 'utf8'));
const dur = Object.fromEntries(segs.map(s => [s.id, Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${V}/build/${s.id}.mp3`).toString())]));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: false, args: ['--headless=new'] });
const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,214,0,.55);border:2px solid #141414;box-shadow:0 0 0 6px rgba(255,214,0,.25);z-index:2147483647;pointer-events:none;transition:transform .12s';
    document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'scale(.7)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
  });
});
const p = await ctx.newPage();
import { mkdirSync, rmSync } from 'node:fs';
rmSync(V + '/build/frames', { recursive: true, force: true }); mkdirSync(V + '/build/frames', { recursive: true });
const frames = [];
let capturing = true;
const t0 = Date.now();
const loop = (async () => { while (capturing) { try { const buf = await p.screenshot({ type: 'jpeg', quality: 86, animations: 'allow', caret: 'initial' }); const i = frames.length; frames.push({ i, t: (Date.now() - t0) / 1000 }); writeFileSync(`${V}/build/frames/${String(i).padStart(6, '0')}.jpg`, buf); } catch { await new Promise(r => setTimeout(r, 30)); } } })();
p.on('dialog', d => d.accept());
await p.goto(process.env.BASE || 'http://127.0.0.1:8787/'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.mouse.move(270, 480);
const marks = [];
const wait = ms => p.waitForTimeout(ms);
async function settle(l) { let prev = null; for (let k = 0; k < 30; k++) { const b = await l.boundingBox(); if (b && prev && Math.abs(b.y - prev.y) < 0.5) return b; prev = b; await wait(60); } return l.boundingBox(); }
async function to(sel, { click = true, scroll = true } = {}) {
  const l = p.locator(sel).first();
  await l.waitFor({ state: 'visible', timeout: 8000 });
  if (scroll) { await l.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' })); await wait(300); }
  let b = await settle(l);
  const x = Math.min(b.width / 2, 120), y = b.height / 2;
  await p.mouse.move(b.x + x, b.y + y, { steps: 22 });
  await wait(180);
  b = await settle(l);
  await p.mouse.move(b.x + x, b.y + y);
  if (click) { await p.mouse.down(); await wait(90); await p.mouse.up(); await wait(120); }
}
async function seg(id, fn) {
  const start = (Date.now() - t0) / 1000; marks.push({ id, start });
  const s = Date.now(); await fn();
  const left = dur[id] * 1000 + 450 - (Date.now() - s); if (left > 0) await wait(left);
  marks[marks.length - 1].end = (Date.now() - t0) / 1000;
}
async function scrollTo(sel) { await p.locator(sel).first().evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'start' })); await wait(700); }
// The first frames of the recording start before navigation; keep a lead-in.
await wait(600);
await seg('intro', async () => { await to('.context-strip', { click: false }); await wait(1500); await to('#tab-preview', { click: false }); });
await seg('job', async () => { await to('[data-job=meeting]'); });
await seg('edit', async () => {
  await to('#note-title'); await p.keyboard.press('End'); await p.keyboard.type(' · Q4 test', { delay: 70 });
  await to('#save-note');
});
await seg('tasks', async () => {
  for (const n of [2, 3, 6]) { await to(`#lines input[data-line="${n}"]`); await wait(250); }
  await to('#make-tasks'); await wait(400); await scrollTo('.tasks');
});
await seg('revisit', async () => {
  await to('#revisit-day', { click: false }); await p.selectOption('#revisit-day', '2'); await wait(300);
  await to('#schedule'); await to('#simulate'); await wait(300);
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await wait(1800);
  await to('#task-list input[data-act=done]'); await wait(600);
  await to('#upgrade', { click: false }); await wait(400); await to('#up-preview');
});
await seg('import', async () => {
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await wait(600);
  await to('#tab-analysis'); await wait(300); await to('[data-fx=simpson]'); await wait(600); await scrollTo('#step-validate');
});
await seg('contract', async () => { await scrollTo('#step-contract'); await to('#contract input[name=minMatureUsersPerArm]', { click: false, scroll: false }); await wait(1200); await to('#run', { click: false }); });
await seg('simpson', async () => { await to('#run'); await wait(400); await scrollTo('#step-segments'); await wait(2500); await p.mouse.wheel(0, 500); await wait(1200); await scrollTo('#decision'); });
await seg('guardrail', async () => { await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await wait(700); await to('[data-fx=guardrail]'); await to('#run'); await scrollTo('#step-decision'); });
await seg('biased', async () => { await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await wait(700); await to('[data-fx=biased]'); await to('#run'); await scrollTo('#step-results'); await wait(2500); await scrollTo('#decision'); });
await seg('export', async () => { await to('#export-memo'); await wait(600); await p.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); });
await wait(800);
capturing = false; await loop;
const total = (Date.now() - t0) / 1000;
let list = '';
frames.forEach((f, k) => { const next = k + 1 < frames.length ? frames[k + 1].t : total; list += `file 'frames/${String(f.i).padStart(6, '0')}.jpg'\nduration ${Math.max(next - f.t, 0.001).toFixed(3)}\n`; });
list += `file 'frames/${String(frames.at(-1).i).padStart(6, '0')}.jpg'\n`;
writeFileSync(V + '/build/frames.txt', list);
const raw = V + '/build/frames.txt';
await ctx.close();
writeFileSync(V + '/build/marks.json', JSON.stringify({ raw, marks, total: (Date.now() - t0) / 1000 }, null, 1));
await browser.close();
console.log(raw, marks.map(m => `${m.id}:${m.start.toFixed(1)}-${m.end.toFixed(1)}`).join(' '));
