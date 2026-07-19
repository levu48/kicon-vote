# CLAUDE.md — Kicon Vote

Project context for Claude Code. This repo is the **vote app**, a client of the
kicon IdP. It is NOT the IdP — the IdP lives in the sibling repo `auth.kicon.com`.

## What this is
The vote app of the kicon platform (Vite + React + TS + oidc-client-ts), built on
`@kicon/platform` from the sibling `kicon-platform` repo. It has **two surfaces on
two origins**, per the settled app-platform rule (IdP repo's
`docs/app-platform-domains.md`). Current milestone: the consumer MVP logs in
against `auth.kicon.com` (Authorization Code + PKCE) and displays identity — the
first real, end-to-end exercise of the IdP by a browser client.

## Repo layout — two surfaces, one repo, TWO build artifacts
npm workspaces. The origin split is a runtime rule, not a repo rule — colocating
is fine, but the repo MUST emit two separate bundles, never one routed by path.

```
consumer/   → vote.kicon.com         client `vote`        embeddable, public SPA (the MVP)
admin/      → admin.vote.kicon.com   client `vote-admin`  privileged; NEVER framed; MFA + forced re-auth
shared/     @kicon-vote/shared       vote-local code both surfaces import (one-way dep)
```

- **One-way dependency:** `consumer/` and `admin/` both import `shared/`; neither
  imports the other. Admin code (its endpoints/secrets) must NEVER end up in the
  embeddable consumer bundle.
- **Across-app** code (design system, OIDC client, types) comes from
  `@kicon/platform` — NOT `shared/`, which is vote-local only.
- The admin surface serves `X-Frame-Options: DENY` / `frame-ancestors 'none'`
  (set in `admin/vite.config.ts` for dev/preview; the CDN/host sets it in prod).
  The consumer surface deliberately does not — it is the embeddable one.
- Build: `npm run build` (both) / `build:consumer` / `build:admin`. Dev:
  `dev:consumer` (:8084) / `dev:admin` (:8085).

## Integration contract with auth.kicon.com (settled)
Two clients, tenant `apps` (`src/identity/tenants.ts`) — one per surface. Do not
diverge from these without changing the IdP (`src/oidc/clients.ts`):

**`vote` — consumer surface (registered):**
- **client_id:** `vote` · public client, **PKCE** (no client secret)
- **grants:** `authorization_code`, `refresh_token` · **response_type:** `code`
- **redirect_uris:** `http://localhost:8084/auth/callback` (dev),
  `https://vote.kicon.com/auth/callback` (prod)
- **post_logout_redirect_uris:** `http://localhost:8084/`, `https://vote.kicon.com/`
- **scopes:** `openid profile email offline_access`
- **assurance:** standard (loa1 / `acr` pwd); seamless SSO allowed

**`vote-admin` — admin surface (registered in `src/oidc/clients.ts`):**
- **client_id:** `vote-admin` · public client, **PKCE**
- **grants:** `authorization_code` · **response_type:** `code` (no refresh token
  on the admin origin — short privileged session, cheap re-auth)
- **redirect_uris:** `http://localhost:8085/auth/callback` (dev),
  `https://admin.vote.kicon.com/auth/callback` (prod)
- **post_logout_redirect_uris:** `http://localhost:8085/`, `https://admin.vote.kicon.com/`
- **scopes:** `openid profile email`
- **assurance:** **MFA mandatory + forced re-auth** (client sends `prompt=login`;
  IdP registration sets `default_max_age: 0` + `default_acr_values: [ACR_MFA]`).
  No silent SSO — mirrors the `vietcouncil` / `xbottrader` pattern. (Static ACR/MFA
  is declared now; actual MFA enforcement is the IdP's later interaction/policy
  phase, same as civic/trader.)

**Both:** the IdP allows each surface's origin on `/token` and `/me` because it
matches that client's registered redirect_uris (client-scoped CORS, not a
wildcard). issuer/discovery: dev `http://localhost:3000`, prod
`https://auth.kicon.com` (`VITE_OIDC_AUTHORITY`); everything else is read from
`/.well-known/openid-configuration`.

Dev loop: run the IdP locally on `:3000`; run consumer on `:8084` and/or admin on
`:8085`; they talk to each other. Prod: served at `vote.kicon.com` /
`admin.vote.kicon.com`, both talking to `auth.kicon.com`.

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
