#
# Kicon Vote

The first app-platform client of the kicon IdP (`auth.kicon.com`). A public SPA
that logs in via **Authorization Code + PKCE** and (for now) displays the signed-in
user's identity — the MVP that proves the IdP end-to-end with a real browser client.
Hosted at `vote.kicon.com` (its own origin). See the IdP repo's
`docs/app-platform-domains.md` for the platform architecture.

## Stack
Vite + React + TypeScript + [`oidc-client-ts`](https://github.com/authts/oidc-client-ts).

## Run it (dev)
The dev build authenticates against a **local** IdP.

1. In the `auth.kicon.com` repo, run the IdP on `:3000` (needs local Postgres + Redis)
   — the `vote` client with redirect `http://localhost:8084/auth/callback` is
   registered there.
2. Here:
   ```bash
   npm install
   npm run dev        # serves on http://localhost:8084 (port is fixed)
   ```
3. Open http://localhost:8084 → **Sign in with Kicon** → log in (or **Create one**)
   → you're returned signed in, showing your id_token claims and a live `/me` call.

Ports/URLs are fixed to match the client registration: **:8084** and
`/auth/callback`. Changing them means updating the client in the IdP repo.

## Config
`VITE_OIDC_AUTHORITY` selects the IdP:
- `.env.development` → `http://localhost:3000`
- `.env.production` → `https://auth.kicon.com`

## What this is NOT (yet)
- No resource server / vote storage — see `CLAUDE.md` for the roadmap.
- Not embedded in any partner site yet (VietCouncil embedding + eligibility bridge
  are a later phase).
