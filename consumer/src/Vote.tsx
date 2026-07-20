import { useCallback, useEffect, useState } from 'react';
import type { User } from '@kicon/platform/oidc';
import { Badge, Button, ErrorText, theme } from '@kicon/platform/ui';
import { KiconApiError, votes, type PollDetail, type PollResults, type PollSummary } from './api';

/**
 * The vote surface, backed by api.kicon.com.
 *
 * This app holds no poll data of its own and never reads the IdP: it learns who
 * the user is from token claims, and everything else comes from the resource
 * server, which keys every row by that user's opaque `sub`.
 */

type Loadable<T> =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; code?: string }
  | { phase: 'ready'; data: T };

export default function Vote({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const name = String(user.profile.name ?? user.profile.email ?? user.profile.sub);
  const [list, setList] = useState<Loadable<PollSummary[]>>({ phase: 'loading' });
  const [openPollId, setOpenPollId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setList({ phase: 'loading' });
    try {
      const { polls } = await votes.list();
      setList({ phase: 'ready', data: polls });
    } catch (e) {
      setList(toError(e));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
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

      {list.phase === 'loading' && <p style={{ color: theme.color.muted }}>Loading polls…</p>}

      {list.phase === 'error' && (
        <>
          <ErrorText>{list.message}</ErrorText>
          <Button variant="secondary" onClick={() => void loadList()} style={{ marginTop: 10 }}>
            Try again
          </Button>
        </>
      )}

      {list.phase === 'ready' && list.data.length === 0 && (
        <p style={{ color: theme.color.muted }}>No polls are open right now.</p>
      )}

      {list.phase === 'ready' &&
        list.data.map((poll) => (
          <PollCard
            key={poll.id}
            summary={poll}
            expanded={openPollId === poll.id}
            onToggle={() => setOpenPollId((id) => (id === poll.id ? null : poll.id))}
          />
        ))}
    </div>
  );
}

function PollCard({
  summary,
  expanded,
  onToggle,
}: {
  summary: PollSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [detail, setDetail] = useState<Loadable<PollDetail> | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setDetail({ phase: 'loading' });
    try {
      const data = await votes.detail(summary.id);
      setDetail({ phase: 'ready', data });
      setSelected(data.myBallot.optionIds);

      // Results are gated server-side (after_close / admin_only). A 403 here is
      // the expected answer while a poll is open, not an error worth surfacing.
      try {
        setResults(await votes.results(summary.id));
      } catch {
        setResults(null);
      }
    } catch (e) {
      setDetail(toError(e));
    }
  }, [summary.id]);

  useEffect(() => {
    if (expanded && !detail) void load();
  }, [expanded, detail, load]);

  const d = detail?.phase === 'ready' ? detail.data : null;
  const multi = (d?.maxSelections ?? 1) > 1;
  const voted = d?.myBallot.voted ?? false;
  const canVote = !!d && d.isOpen && (!voted || d.allowChangeVote);

  async function submit() {
    if (!selected.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await votes.cast(summary.id, selected);
      setNotice({ kind: 'ok', text: res.changed ? 'Your vote was updated.' : 'Vote recorded.' });
      await load();
    } catch (e) {
      // Branch on the API's stable `code`, never the message text — the message
      // is prose and free to be reworded or localised.
      const code = e instanceof KiconApiError ? e.code : '';
      const text =
        code === 'already_voted'
          ? 'You have already voted in this poll.'
          : code === 'not_eligible'
            ? 'You are not eligible to vote in this poll.'
            : code === 'poll_closed'
              ? 'This poll is no longer open.'
              : code === 'too_many_selections'
                ? `Select at most ${d?.maxSelections ?? 1} option(s).`
                : e instanceof Error
                  ? e.message
                  : 'Something went wrong.';
      setNotice({ kind: 'err', text });
      // Re-sync when the server's view of the world has clearly moved on.
      if (code === 'already_voted' || code === 'poll_closed') await load();
    } finally {
      setBusy(false);
    }
  }

  function toggleOption(id: string) {
    setSelected((cur) => {
      if (!multi) return [id];
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      // Mirror max_selections locally for responsiveness. The server enforces
      // it regardless — this is UX, not a control.
      if (cur.length >= (d?.maxSelections ?? 1)) return cur;
      return [...cur, id];
    });
  }

  return (
    <div
      style={{
        border: `1px solid ${theme.color.surfaceBorder}`,
        borderRadius: theme.radius.lg,
        padding: 16,
        marginBottom: 14,
        background: theme.color.surface,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{summary.title}</h2>
        {summary.isOpen ? (
          <Badge>open</Badge>
        ) : (
          <span style={{ color: theme.color.subtle, fontSize: '.8rem' }}>closed</span>
        )}
      </div>

      {!expanded && (
        <Button variant="secondary" onClick={onToggle} style={{ marginTop: 12 }}>
          {summary.isOpen ? 'View & vote' : 'View results'}
        </Button>
      )}

      {expanded && detail?.phase === 'loading' && (
        <p style={{ color: theme.color.muted, marginTop: 12 }}>Loading…</p>
      )}
      {expanded && detail?.phase === 'error' && <ErrorText>{detail.message}</ErrorText>}

      {expanded && d && (
        <div style={{ marginTop: 12 }}>
          {d.description && (
            <p style={{ color: theme.color.muted, fontSize: '.9rem' }}>{d.description}</p>
          )}
          {multi && (
            <p style={{ color: theme.color.subtle, fontSize: '.8rem', margin: '0 0 8px' }}>
              Choose up to {d.maxSelections}.
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.options.map((o) => {
              const isSelected = selected.includes(o.id);
              const count = results?.options.find((r) => r.optionId === o.id)?.count;
              return (
                <Button
                  key={o.id}
                  variant={isSelected ? 'primary' : 'secondary'}
                  disabled={!canVote || busy}
                  onClick={() => toggleOption(o.id)}
                  title={
                    canVote ? undefined : voted ? 'You have already voted' : 'Voting is closed'
                  }
                >
                  {o.label}
                  {count !== undefined && (
                    <span style={{ opacity: 0.7, marginLeft: 6 }}>· {count}</span>
                  )}
                </Button>
              );
            })}
          </div>

          {canVote && (
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => void submit()} disabled={busy || selected.length === 0}>
                {busy ? 'Submitting…' : voted ? 'Update my vote' : 'Submit vote'}
              </Button>
            </div>
          )}

          {voted && !d.allowChangeVote && (
            <p style={{ color: theme.color.subtle, fontSize: '.8rem', marginTop: 10 }}>
              You have voted. This poll does not allow changes.
            </p>
          )}

          {results && (
            <p style={{ color: theme.color.subtle, fontSize: '.8rem', marginTop: 10 }}>
              {results.totalVoters} {results.totalVoters === 1 ? 'person has' : 'people have'}{' '}
              voted.
            </p>
          )}
          {!results && d.resultsVisibility === 'after_close' && d.isOpen && (
            <p style={{ color: theme.color.subtle, fontSize: '.8rem', marginTop: 10 }}>
              Results are published when this poll closes.
            </p>
          )}

          {/*
            Deliberate wording. `private` means no API path reveals who voted for
            what — it is NOT a secret ballot, because each ballot is stored
            against the voter's id. Saying "secret" or "anonymous" here would be
            false, and a voter who believed it might vote differently than they
            otherwise would. See kicon-api/docs/ballot-secrecy.md.
          */}
          {d.ballotSecrecy === 'private' && (
            <p style={{ color: theme.color.subtle, fontSize: '.8rem', marginTop: 6 }}>
              Individual votes are not shown to other voters or published in results.
            </p>
          )}

          {notice && (
            <p
              style={{
                marginTop: 10,
                fontSize: '.85rem',
                color: notice.kind === 'ok' ? theme.color.successText : theme.color.errorText,
              }}
            >
              {notice.text}
            </p>
          )}

          <Button variant="secondary" onClick={onToggle} style={{ marginTop: 12 }}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

function toError(e: unknown): { phase: 'error'; message: string; code?: string } {
  if (e instanceof KiconApiError) {
    // 503 means the API cannot verify tokens (an IdP blip), NOT that the
    // session is bad. Telling the user to sign in again would be wrong advice
    // and would throw away a perfectly good session.
    if (e.isUnavailable) {
      return {
        phase: 'error',
        message: 'The service is temporarily unavailable. Please try again in a moment.',
        code: e.code,
      };
    }
    if (e.isAuthError) {
      return {
        phase: 'error',
        message: 'Your session has expired. Please sign in again.',
        code: e.code,
      };
    }
    return { phase: 'error', message: e.message, code: e.code };
  }
  return { phase: 'error', message: e instanceof Error ? e.message : String(e) };
}
