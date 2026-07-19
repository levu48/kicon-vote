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

/** The IdP tenant this whole app belongs to (never food/civic/trader). */
export const VOTE_TENANT = 'apps';
