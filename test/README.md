# Browser tests

Real-browser checks driven by Playwright against the system Chrome
(`channel: 'chrome'` — no bundled-browser download).

| file | what it proves |
|---|---|
| `token-path.mjs` | The SPAs actually send `resource=` and receive a **JWT** for `aud=https://api.kicon.com`, not an opaque userinfo token. Also that the consumer cannot obtain `vote:admin` and the admin reaches `acr=loa2`. |
| `journey.mjs` | The whole loop through the UI: admin creates and opens a poll → consumer votes → admin sees the tally. |

## Why these exist

A scripted OAuth flow builds its own `/authorize` URL, so it can pass while the
SPA silently omits `resource` — login succeeds and every API call then 401s.
Only a real browser proves what `oidc-client-ts` actually sends. That failure is
invisible until it happens, and it happens in production, not in a script.

## Running

Needs four things running: kicon-auth (`:3000`), kicon-api (`:3100`), and both
surfaces (`:8084`, `:8085`).

```bash
npm --workspace @kicon-vote/consumer run dev
npm --workspace @kicon-vote/admin run dev

npx playwright@1.61.1 --version   # or: npm i -D playwright
node test/token-path.mjs
node test/journey.mjs
```

`journey.mjs` requires the signed-in admin to hold the `poll_manager` role at
the API:

```bash
# in kicon-api
npm run role:grant -- --app vote --sub u_8f3c --role poll_manager
```
