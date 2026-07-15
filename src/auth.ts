import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

/**
 * OIDC client for the `vote` app against auth.kicon.com.
 *
 * We use oidc-client-ts (a vetted library) rather than hand-rolling the flow.
 * Under the hood it performs Authorization Code + PKCE:
 *   - signinRedirect(): generates a code_verifier/code_challenge (S256), stores
 *     the verifier + state + nonce, and sends the browser to the IdP's /auth.
 *   - signinRedirectCallback(): on return to /auth/callback, validates state,
 *     exchanges ?code at /token using the stored verifier, validates the id_token
 *     signature (ES256, via the IdP's JWKS) + nonce, and stores the User.
 *   - automaticSilentRenew: uses the refresh token (offline_access) to renew the
 *     access token before it expires, with rotation + reuse detection at the IdP.
 *
 * The IdP allows this app's origin on /token and /me via client-scoped CORS
 * (only origins matching the vote client's registered redirect_uris).
 */
export const userManager = new UserManager({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  client_id: 'vote',
  // Derive from the current origin so dev (:8084) and prod (vote.kicon.com) both
  // work without per-env config — these must match the registered redirect_uris.
  redirect_uri: `${window.location.origin}/auth/callback`,
  // Popup flow (for embedding on partner sites): the popup navigates here after
  // auth. It runs top-level against auth.kicon.com, so first-party cookies apply
  // and an existing SSO session completes with no prompt — no third-party cookies.
  // Must be registered as a redirect_uri on the vote client in the IdP repo.
  popup_redirect_uri: `${window.location.origin}/auth/popup-callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid profile email offline_access',
  // The IdP only issues offline_access (and thus a refresh token) when the
  // request carries prompt=consent — even for first-party clients, where it is
  // AUTO-APPROVED server-side with no consent screen (verified against the IdP).
  // Without this, oidc-provider strips offline_access and no refresh token is
  // issued, so automaticSilentRenew would have nothing to renew with.
  prompt: 'consent',
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

export const getUser = (): Promise<User | null> => userManager.getUser();
export const login = (): Promise<void> => userManager.signinRedirect();
export const completeLogin = (): Promise<User> => userManager.signinRedirectCallback();
export const logout = (): Promise<void> => userManager.signoutRedirect();

/**
 * Popup sign-in — the flow to use when the app is embedded in a partner site.
 * Opens auth.kicon.com in a top-level popup window (first-party context), so a
 * seamless SSO session there completes without a prompt. Tokens land in THIS
 * origin's store; the partner page never sees them. Resolves with the User.
 */
export const loginPopup = (): Promise<User> => userManager.signinPopup();

/**
 * Runs inside the popup window at /auth/popup-callback: finishes the handshake
 * (posts the result to the opener) and closes the popup. See main.tsx.
 */
export const completePopup = (): Promise<void> => userManager.signinPopupCallback();

/** Live call to the IdP userinfo endpoint (/me) with the access token. */
export async function fetchUserInfo(accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${import.meta.env.VITE_OIDC_AUTHORITY}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  return res.json();
}
