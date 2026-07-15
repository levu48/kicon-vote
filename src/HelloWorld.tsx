import type { User } from 'oidc-client-ts';

/**
 * Placeholder landing page shown after a successful login.
 * Real content (polls / votes keyed by `sub`) will replace this once the
 * resource server exists — see roadmap step 2 in CLAUDE.md.
 */
export default function HelloWorld({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const name = String(user.profile.name ?? user.profile.email ?? user.profile.sub);

  return (
    <div style={styles.wrap}>
      <div style={styles.badge}>✅ signed in</div>
      <h1 style={styles.h1}>Hello, {name} 👋</h1>
      <p style={styles.sub}>
        You’re authenticated against <strong>auth.kicon.com</strong>. This is a
        placeholder landing page — polls and votes will live here soon.
      </p>
      <button style={styles.btn} onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { textAlign: 'center' },
  badge: {
    display: 'inline-block',
    fontSize: '.7rem',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    color: '#7ee0a8',
    background: '#123024',
    border: '1px solid #1f5c3f',
    borderRadius: 999,
    padding: '3px 10px',
    marginBottom: 14,
  },
  h1: { fontSize: '1.4rem', margin: '0 0 8px' },
  sub: { margin: 0, color: '#aab1c0', fontSize: '.9rem', lineHeight: 1.6 },
  btn: {
    marginTop: 22,
    padding: '11px 16px',
    border: 0,
    borderRadius: 9,
    background: '#4f7cff',
    color: '#fff',
    fontWeight: 600,
    fontSize: '.95rem',
    cursor: 'pointer',
  },
};
