import { useEffect, useState } from 'react';
import type { User } from 'oidc-client-ts';
import { getUser, login, logout, completeLogin, fetchUserInfo } from './auth';

type State =
  | { phase: 'loading' }
  | { phase: 'anonymous' }
  | { phase: 'error'; message: string }
  | { phase: 'signed-in'; user: User; userinfo?: Record<string, unknown> };

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
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>🗳️ Kicon Vote</h1>
        <p style={styles.sub}>First app-platform client of auth.kicon.com — SPA + PKCE.</p>

        {state.phase === 'loading' && <p>…</p>}

        {state.phase === 'anonymous' && (
          <>
            <p style={styles.muted}>You are not signed in.</p>
            <button style={styles.btn} onClick={() => void login()}>
              Sign in with Kicon
            </button>
          </>
        )}

        {state.phase === 'error' && (
          <p style={styles.err}>Auth error: {state.message}</p>
        )}

        {state.phase === 'signed-in' && (
          <>
            <p style={styles.muted}>
              Signed in as <strong>{String(state.user.profile.name ?? state.user.profile.sub)}</strong>
            </p>
            <Section title="id_token claims">
              <Claims data={state.user.profile as Record<string, unknown>} />
            </Section>
            <Section title="/me (userinfo — live token call)">
              {state.userinfo ? <Claims data={state.userinfo} /> : <p style={styles.muted}>loading…</p>}
            </Section>
            <button style={styles.btn} onClick={() => void logout()}>
              Sign out
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Claims({ data }: { data: Record<string, unknown> }) {
  return (
    <pre style={styles.pre}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    display: 'grid',
    placeItems: 'center',
    background: '#0f1115',
    color: '#e7e9ee',
    font: '15px/1.5 system-ui, sans-serif',
  },
  card: {
    width: 'min(92vw, 480px)',
    background: '#171a21',
    border: '1px solid #262b36',
    borderRadius: 14,
    padding: 28,
    boxShadow: '0 10px 40px rgba(0,0,0,.4)',
  },
  h1: { fontSize: '1.3rem', margin: '0 0 4px' },
  sub: { margin: '0 0 16px', color: '#aab1c0', fontSize: '.85rem' },
  muted: { color: '#aab1c0' },
  err: { color: '#ffb3bd', background: '#3a1d22', border: '1px solid #6b2d38', padding: '8px 11px', borderRadius: 8 },
  btn: {
    marginTop: 18,
    padding: '11px 16px',
    border: 0,
    borderRadius: 9,
    background: '#4f7cff',
    color: '#fff',
    fontWeight: 600,
    fontSize: '.95rem',
    cursor: 'pointer',
  },
  sectionTitle: { fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#6b7280', marginBottom: 6 },
  pre: {
    margin: 0,
    background: '#0f1115',
    border: '1px solid #2c3240',
    borderRadius: 8,
    padding: 12,
    fontSize: '.8rem',
    overflowX: 'auto',
  },
};
