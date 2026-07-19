import type { User } from '@kicon/platform/oidc';
import { Badge, Button, theme } from '@kicon/platform/ui';

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
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 14 }}>
        <Badge>✅ signed in</Badge>
      </div>
      <h1 style={{ fontSize: '1.4rem', margin: '0 0 8px' }}>Hello, {name} 👋</h1>
      <p style={{ margin: 0, color: theme.color.muted, fontSize: '.9rem', lineHeight: 1.6 }}>
        You’re authenticated against <strong>auth.kicon.com</strong>. This is a
        placeholder landing page — polls and votes will live here soon.
      </p>
      <Button style={{ marginTop: 22 }} onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}
