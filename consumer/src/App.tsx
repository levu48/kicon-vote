import { useEffect, useState } from 'react';
import type { User } from '@kicon/platform/oidc';
import type { KiconClaims } from '@kicon/platform/types';
import { AppShell, Panel, Button, Section, Claims, ErrorText, theme } from '@kicon/platform/ui';
import { getUser, login, loginPopup, logoutPopup, completeLogin, fetchUserInfo } from './auth';
import HelloWorld from './HelloWorld';

type State =
  | { phase: 'loading' }
  | { phase: 'anonymous' }
  | { phase: 'error'; message: string }
  | { phase: 'signed-in'; user: User; userinfo?: KiconClaims };

export default function App() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        // Handle the redirect back from the IdP: /auth/callback?code=...&state=...
        if (window.location.pathname === '/auth/callback') {
          const user = await completeLogin();
          window.history.replaceState({}, '', '/'); // drop code/state from the URL
          setState({ phase: 'signed-in', user });
          return;
        }
        const user = await getUser();
        setState(user && !user.expired ? { phase: 'signed-in', user } : { phase: 'anonymous' });
      } catch (e) {
        setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, []);

  // Once signed in, prove the access token works by calling /me (userinfo).
  useEffect(() => {
    if (state.phase === 'signed-in' && !state.userinfo && state.user.access_token) {
      fetchUserInfo(state.user.access_token)
        .then((userinfo) => setState((s) => (s.phase === 'signed-in' ? { ...s, userinfo } : s)))
        .catch(() => void 0);
    }
  }, [state]);

  return (
    <AppShell>
      <Panel>
        <h1 style={{ fontSize: '1.3rem', margin: '0 0 4px' }}>🗳️ Kicon Vote</h1>
        <p style={{ margin: '0 0 16px', color: theme.color.muted, fontSize: '.85rem' }}>
          First app-platform client of auth.kicon.com — SPA + PKCE.
        </p>

        {state.phase === 'loading' && <p>…</p>}

        {state.phase === 'anonymous' && (
          <>
            <p style={{ color: theme.color.muted }}>You are not signed in.</p>
            <Button onClick={() => void login()}>Sign in with Kicon</Button>
            <Button
              variant="secondary"
              style={{ marginLeft: 10 }}
              title="Popup flow — this is what an embedded widget on a partner site uses"
              onClick={() =>
                loginPopup()
                  .then((user) => setState({ phase: 'signed-in', user }))
                  .catch((e) =>
                    setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }),
                  )
              }
            >
              Sign in (popup)
            </Button>
          </>
        )}

        {state.phase === 'error' && <ErrorText>Auth error: {state.message}</ErrorText>}

        {state.phase === 'signed-in' && (
          <>
            <HelloWorld
              user={state.user}
              onSignOut={() =>
                logoutPopup()
                  .then(() => setState({ phase: 'anonymous' }))
                  .catch((e) =>
                    setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }),
                  )
              }
            />
            <Section title="id_token claims">
              <Claims data={state.user.profile as Record<string, unknown>} />
            </Section>
            <Section title="/me (userinfo — live token call)">
              {state.userinfo ? (
                <Claims data={state.userinfo} />
              ) : (
                <p style={{ color: theme.color.muted }}>loading…</p>
              )}
            </Section>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
