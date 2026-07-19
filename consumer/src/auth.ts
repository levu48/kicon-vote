import { createAuthClient } from '@kicon/platform/oidc';
import { VOTE_CLIENTS } from '@kicon-vote/shared';

/**
 * OIDC client for the vote CONSUMER surface (vote.kicon.com). All the mechanics
 * — Authorization Code + PKCE, the prompt=consent dance for refresh tokens,
 * origin-derived redirect URIs, the /me userinfo call — live in
 * @kicon/platform/oidc and are shared with every other app-platform client.
 * Here we only supply what's app-specific: the IdP authority (dev vs prod, via
 * env) and this surface's registered client id (`vote`). Standard assurance,
 * seamless SSO — the embeddable public surface.
 */
export const auth = createAuthClient({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: VOTE_CLIENTS.consumer,
});

// Re-export the handlers as standalone functions to keep call sites terse. The
// client's methods are arrow functions that close over the UserManager
// lexically (no `this`), so destructuring them is safe.
export const {
  getUser,
  login,
  loginPopup,
  completeLogin,
  completePopup,
  logout,
  fetchUserInfo,
} = auth;
