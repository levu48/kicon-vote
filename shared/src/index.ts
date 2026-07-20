/**
 * @kicon-vote/shared — vote-local code shared by both surfaces.
 *
 * Scope rule (see the IdP repo's docs/app-platform-domains.md):
 *   - Shared ACROSS apps (design system, OIDC client, identity types)  → @kicon/platform
 *   - Shared only WITHIN the vote app (both its surfaces)               → here
 *   - Specific to one surface                                          → that surface's src/
 *
 * The dependency is strictly one-way: consumer/ and admin/ import this; this
 * imports neither. Nothing here may pull in admin-only code, or it could leak
 * into the embeddable consumer bundle.
 */

/**
 * The vote app's two registered OAuth clients at auth.kicon.com — one per
 * surface/origin. Kept here so both surfaces agree on the ids and so the values
 * are documented in exactly one place.
 */
export const VOTE_CLIENTS = {
  /** consumer surface → vote.kicon.com. Public SPA + PKCE, seamless SSO, loa1. */
  consumer: 'vote',
  /** admin surface → admin.vote.kicon.com. Separate client, MFA + forced re-auth. */
  admin: 'vote-admin',
} as const;

/** Baseline scopes every vote surface requests. */
export const VOTE_SCOPES = 'openid profile email offline_access';

/**
 * The resource server this app calls, as an RFC 8707 resource indicator.
 *
 * This value MUST match `API_AUDIENCE` at api.kicon.com and the identifier
 * registered in kicon-auth's src/oidc/resource-servers.ts. All three move
 * together — a mismatch means the IdP mints a token the API rejects on every
 * request.
 *
 * Without it the IdP issues a userinfo-audience OPAQUE token, which the API
 * cannot verify: login appears to succeed and every API call returns 401.
 */
export const KICON_API_RESOURCE = 'https://api.kicon.com';

/**
 * Resource-server scopes per surface.
 *
 * Requesting more than a client is registered for is not an error — the IdP
 * silently issues less (its per-client map in resource-servers.ts is the real
 * boundary). So these are what each surface EXPECTS to receive, not a
 * privilege claim: the consumer genuinely cannot obtain vote:admin.
 */
export const VOTE_API_SCOPES = {
  consumer: 'vote:read vote:write',
  admin: 'vote:read vote:write vote:admin',
} as const;

/** The IdP tenant this whole app belongs to (never food/civic/trader). */
export const VOTE_TENANT = 'apps';
