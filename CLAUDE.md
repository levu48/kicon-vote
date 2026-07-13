# CLAUDE.md — Kicon Vote

Project context for Claude Code. This repo is the **vote app**, a client of the
kicon IdP. It is NOT the IdP — the IdP lives in the sibling repo `auth.kicon.com`.

## What this is
A public SPA (Vite + React + TS + oidc-client-ts) hosted at `vote.kicon.com`, the
first app of the kicon app platform. Current milestone: an MVP that logs in against
`auth.kicon.com` (Authorization Code + PKCE) and displays identity — the first
real, end-to-end exercise of the IdP by a browser client.

## Integration contract with auth.kicon.com (settled)
Registered as client `vote` in the IdP repo (`src/oidc/clients.ts`), tenant `apps`
(`src/identity/tenants.ts`). Do not diverge from these without changing the IdP:

- **client_id:** `vote` · public client, **PKCE** (no client secret)
- **grants:** `authorization_code`, `refresh_token` · **response_type:** `code`
- **redirect_uris:** `http://localhost:8084/auth/callback` (dev),
  `https://vote.kicon.com/auth/callback` (prod)
- **post_logout_redirect_uris:** `http://localhost:8084/`, `https://vote.kicon.com/`
- **scopes:** `openid profile email offline_access`
- **assurance:** standard (loa1 / `acr` pwd); seamless SSO allowed
- **CORS:** the IdP allows this app's origin on `/token` and `/me` because it
  matches the client's registered redirect_uris (client-scoped CORS, not a wildcard)
- **issuer/discovery:** dev `http://localhost:3000`, prod `https://auth.kicon.com`
  (`VITE_OIDC_AUTHORITY`); everything else is read from `/.well-known/openid-configuration`

Dev loop: run the IdP locally on `:3000`; run this app on `:8084`; they talk to
each other. Prod: this app is served at `vote.kicon.com` and talks to `auth.kicon.com`.

## Hard boundaries (from the IdP's CLAUDE.md / data-ownership.md)
- This app learns identity ONLY through tokens (`sub` + claims). It **never** reads
  the IdP database. Any vote data it stores is its **own**, keyed by `sub`.
- It is tenant `apps`: it must never receive or rely on food/civic/trader claims.
- It gets no special access to auth cookies. Cross-org embedding authenticates via
  top-level/popup OIDC or a parent-passed token — never by sharing the auth session.

## Roadmap (in order)
1. **MVP (this):** login + show identity. Proves the IdP end-to-end.
2. **Resource server + storage** (`api.kicon.com`): real polls/votes keyed by `sub`,
   enforced on scoped access tokens. This app's data lives here, not in the IdP.
3. **Embedding + eligibility bridge:** embed in partner sites (e.g. vietcouncil.org).
   "Who may vote in a civic poll" is authorization the *partner* vouches for to the
   vote resource server — never civic identity claims crossing the partition. See
   the IdP repo's `docs/app-platform-domains.md`.

## Working agreement
- Keep the client config in lockstep with the IdP registration; if you need a new
  redirect URI / scope / grant, change the IdP repo too and note it here.
- Prefer the vetted oidc-client-ts flow over hand-rolling token handling.
