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

/** Live call to the IdP userinfo endpoint (/me) with the access token. */
export async function fetchUserInfo(accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${import.meta.env.VITE_OIDC_AUTHORITY}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  return res.json();
}
