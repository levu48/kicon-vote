import type { User } from '@kicon/platform/oidc';
import { Badge, Button, theme } from '@kicon/platform/ui';

/**
 * Placeholder vote surface shown after a successful login.
 *
 * The polls below are hard-coded stand-ins. Real polls and votes — keyed by the
 * signed-in user's `sub` and enforced on scoped access tokens — will replace this
 * once the resource server exists (`api.kicon.com`). See roadmap step 2 in
 * CLAUDE.md. This app never reads the IdP database; it learns identity only from
 * the token claims passed in via `user`.
 */

type Poll = {
  id: string;
  question: string;
  options: string[];
};

const PLACEHOLDER_POLLS: Poll[] = [
  {
    id: 'poll-mascot',
    question: 'Which mascot should represent Kicon?',
    options: ['🦊 Fox', '🦉 Owl', '🐙 Octopus'],
  },
  {
    id: 'poll-launch',
    question: 'When should we ship the public beta?',
    options: ['This quarter', 'Next quarter', 'When it’s ready'],
  },
];

export default function Vote({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const name = String(user.profile.name ?? user.profile.email ?? user.profile.sub);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <Badge>✅ signed in</Badge>
          <p style={{ margin: '8px 0 0', fontSize: '.9rem', color: theme.color.muted }}>
            Voting as <strong style={{ color: theme.color.text }}>{name}</strong>
          </p>
        </div>
        <Button variant="secondary" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      {PLACEHOLDER_POLLS.map((poll) => (
        <div
          key={poll.id}
          style={{
            border: `1px solid ${theme.color.surfaceBorder}`,
            borderRadius: theme.radius.lg,
            padding: 16,
            marginBottom: 14,
            background: theme.color.surface,
          }}
        >
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 12px' }}>{poll.question}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {poll.options.map((option) => (
              <Button
                key={option}
                variant="secondary"
                disabled
                title="Voting is not wired up yet — placeholder"
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      ))}

      <p style={{ margin: '4px 0 0', fontSize: '.8rem', color: theme.color.subtle, lineHeight: 1.6 }}>
        These polls are placeholders. Real polls and votes — keyed to your account —
        arrive with the vote resource server.
      </p>
    </div>
  );
}
