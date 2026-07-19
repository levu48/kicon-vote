import { createAuthClient } from '@kicon/platform/oidc';
import { VOTE_CLIENTS } from '@kicon-vote/shared';

/**
 * OIDC client for the vote ADMIN surface (admin.vote.kicon.com).
 *
 * Same shared @kicon/platform/oidc engine as the consumer surface, but a
 * deliberately stricter posture — this is the privileged origin:
 *   - Separate client id `vote-admin` (its own registration + CORS at the IdP).
 *   - prompt=login → force a fresh authentication every time, even with an
 *     existing kicon session (mirrors the civic/trader pattern). The IdP also
 *     enforces MFA + a low default_max_age for this client server-side.
 *   - No offline_access / no silent renew → no long-lived refresh token on the
 *     admin origin; the privileged session is short and re-auth is cheap.
 *   - No popup flow → the admin surface is never embedded, so it only ever does
 *     a top-level redirect.
 */
export const auth = createAuthClient({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: VOTE_CLIENTS.admin,
  scope: 'openid profile email',
  prompt: 'login',
  automaticSilentRenew: false,
});

export const { getUser, login, completeLogin, logout, fetchUserInfo } = auth;
