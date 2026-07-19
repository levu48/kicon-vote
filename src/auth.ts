import { createAuthClient } from '@kicon/platform/oidc';

/**
 * OIDC client for the `vote` app. All the mechanics — Authorization Code + PKCE,
 * the prompt=consent dance for refresh tokens, origin-derived redirect URIs, the
 * /me userinfo call — live in @kicon/platform/oidc and are shared with every
 * other app-platform client. Here we only supply what's app-specific: the IdP
 * authority (dev vs prod, via env) and this client's registered id.
 */
export const auth = createAuthClient({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: 'vote',
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
