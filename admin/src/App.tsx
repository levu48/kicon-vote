import { useEffect, useState } from 'react';
import type { User } from '@kicon/platform/oidc';
import { AppShell, Panel, Button, Section, Claims, ErrorText, Badge, theme } from '@kicon/platform/ui';
import { getUser, login, logout, completeLogin } from './auth';
import Polls from './Polls';

type State =
  | { phase: 'loading' }
  | { phase: 'anonymous' }
  | { phase: 'error'; message: string }
  | { phase: 'signed-in'; user: User };

export default function App() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        if (window.location.pathname === '/auth/callback') {
          const user = await completeLogin();
          window.history.replaceState({}, '', '/');
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

  return (
    <AppShell>
      <Panel>
        <div style={{ marginBottom: 12 }}>
          <Badge>🔒 admin</Badge>
        </div>
        <h1 style={{ fontSize: '1.3rem', margin: '0 0 4px' }}>Kicon Vote — Admin</h1>
        <p style={{ margin: '0 0 16px', color: theme.color.muted, fontSize: '.85rem' }}>
          Privileged console on its own origin (admin.vote.kicon.com). Never framed;
          MFA + forced re-auth enforced at auth.kicon.com.
        </p>

        {state.phase === 'loading' && <p>…</p>}

        {state.phase === 'anonymous' && (
          <>
            <p style={{ color: theme.color.muted }}>Admin sign-in required.</p>
            <Button onClick={() => void login()}>Sign in to admin</Button>
          </>
        )}

        {state.phase === 'error' && <ErrorText>Auth error: {state.message}</ErrorText>}

        {state.phase === 'signed-in' && (
          <>
            <p style={{ color: theme.color.muted }}>
              Signed in as{' '}
              <strong>{String(state.user.profile.name ?? state.user.profile.email ?? state.user.profile.sub)}</strong>.
            </p>
            <Button variant="secondary" style={{ marginTop: 12 }} onClick={() => void logout()}>
              Sign out
            </Button>
            <Polls />

            <Section title="id_token claims">
              <Claims data={state.user.profile as Record<string, unknown>} />
            </Section>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
