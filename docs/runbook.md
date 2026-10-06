# Runbook

```bash
npm install
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run fixtures       # regenerate public/fixtures/*.csv deterministically
npm run dev            # wrangler dev → http://127.0.0.1:8787
npm run deploy         # wrangler deploy (needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
```

Health: `GET /api/health` returns JSON with `ok: true`.

| Symptom | Check |
|---|---|
| Preview looks stuck | Reset local data (button), or clear the site's localStorage key `habit-to-value-studio.v1` |
| Upload says schema invalid | The header must match data-dictionary.md exactly |
| Fixture decision changed | Re-run `npm test`. The scenario tests pin SCALE / ITERATE / REJECT / NO DECISION |
