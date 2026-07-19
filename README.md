# Kicon Vote

The vote app of the kicon platform — a client of the IdP (`auth.kicon.com`). It
has **two surfaces on two origins** (the settled app-platform rule; see the IdP
repo's `docs/app-platform-domains.md`):

| Surface | Dir | Origin | OAuth client | Notes |
|---|---|---|---|---|
| **Consumer** | [`consumer/`](consumer/) | `vote.kicon.com` | `vote` | Public, embeddable SPA. Logs in via **Authorization Code + PKCE**, shows identity (the MVP). |
| **Admin** | [`admin/`](admin/) | `admin.vote.kicon.com` | `vote-admin` | Privileged console. **Never framed**; MFA + forced re-auth at the IdP. Skeleton for now. |

[`shared/`](shared/) holds vote-local code both surfaces use (`@kicon-vote/shared`).
Anything shared *across* apps comes from `@kicon/platform` instead.

> **Two separate build artifacts, one per origin — never one bundle split by path.**
> The consumer bundle must never contain admin code. Enforced structurally: they
> are separate npm workspaces; the dependency on `shared/` is one-way.

## Stack
npm workspaces · Vite + React + TypeScript + [`oidc-client-ts`](https://github.com/authts/oidc-client-ts),
building on `@kicon/platform` (`/oidc`, `/ui`, `/types`) from the sibling repo.

## Run it (dev)
Both surfaces authenticate against a **local** IdP.

1. In the `auth.kicon.com` repo, run the IdP on `:3000` (needs local Postgres +
   Redis). It must have the `vote` client (redirect `http://localhost:8084/auth/callback`)
   and — for the admin surface — the `vote-admin` client
   (redirect `http://localhost:8085/auth/callback`) registered.
2. Here, from the repo root:
   ```bash
   npm install            # installs all workspaces
   npm run dev:consumer   # http://localhost:8084  (consumer, fixed port)
   npm run dev:admin      # http://localhost:8085  (admin, fixed port)
   ```
3. Consumer: open http://localhost:8084 → **Sign in with Kicon** → returned
   signed in, showing id_token claims + a live `/me` call.
   Admin: open http://localhost:8085 → **Sign in to admin** (forces a fresh
   auth via `prompt=login`).

Ports/URLs are fixed to match the client registrations: consumer **:8084**,
admin **:8085**, both `/auth/callback`. Changing them means updating the clients
in the IdP repo.

## Build
```bash
npm run build            # builds BOTH surfaces -> consumer/dist + admin/dist
npm run build:consumer   # just vote.kicon.com
npm run build:admin      # just admin.vote.kicon.com
```

## Config
Each surface has its own `.env.development` / `.env.production`; `VITE_OIDC_AUTHORITY`
selects the IdP (`http://localhost:3000` dev, `https://auth.kicon.com` prod).

## What this is NOT (yet)
- No resource server / vote storage — see `CLAUDE.md` for the roadmap.
- `admin/` is a login skeleton — no poll/config/moderation tools yet.
- Not embedded in any partner site yet (VietCouncil embedding + eligibility bridge
  are a later phase).
