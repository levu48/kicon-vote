import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorText, Section, theme } from '@kicon/platform/ui';
import {
  KiconApiError,
  adminPolls,
  type AdminPollSummary,
  type PollResults,
} from './api';

/**
 * Poll management.
 *
 * Every call here hits an admin route, which the API gates on three independent
 * things: the vote:admin scope, MFA (acr=loa2), AND a poll_manager role in its
 * own table. Signing in at this origin grants the first two — a 403 with code
 * `forbidden` means the third is missing, which is a deliberate and common
 * state, not a bug. It is surfaced explicitly below because "nothing loads and
 * I don't know why" is the worst possible admin experience.
 */

type Loadable<T> =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; code?: string }
  | { phase: 'ready'; data: T };

export default function Polls() {
  const [list, setList] = useState<Loadable<AdminPollSummary[]>>({ phase: 'loading' });
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, PollResults>>({});

  const load = useCallback(async () => {
    setList({ phase: 'loading' });
    try {
      const { polls } = await adminPolls.list();
      setList({ phase: 'ready', data: polls });
    } catch (e) {
      setList(toError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(id: string, action: 'open' | 'close' | 'archive') {
    setBusyId(id);
    try {
      await adminPolls[action](id);
      await load();
    } catch (e) {
      setList(toError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function showResults(id: string) {
    try {
      // Resolve BEFORE updating state — the updater passed to setState is a
      // plain function and cannot await.
      const data = await adminPolls.results(id);
      setResults((r) => ({ ...r, [id]: data }));
    } catch {
      /* leave results absent; the list still renders */
    }
  }

  if (list.phase === 'error' && list.code === 'forbidden') {
    return (
      <Section title="Polls">
        <ErrorText>You are signed in, but you do not have the poll_manager role.</ErrorText>
        <p style={{ color: theme.color.muted, fontSize: '.85rem', marginTop: 8 }}>
          Admin authority is granted at the resource server, not by signing in here. An operator
          grants it with:
        </p>
        <pre
          style={{
            background: theme.color.inset,
            border: `1px solid ${theme.color.insetBorder}`,
            borderRadius: theme.radius.sm,
            padding: 10,
            fontSize: '.8rem',
            overflowX: 'auto',
          }}
        >
          npm run role:grant -- --app vote --sub &lt;your sub&gt; --role poll_manager
        </pre>
      </Section>
    );
  }

  return (
    <Section title="Polls">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button onClick={() => setCreating((c) => !c)}>
          {creating ? 'Cancel' : 'New poll'}
        </Button>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {creating && (
        <CreatePoll
          onCreated={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}

      {list.phase === 'loading' && <p style={{ color: theme.color.muted }}>Loading…</p>}
      {list.phase === 'error' && list.code !== 'forbidden' && <ErrorText>{list.message}</ErrorText>}

      {list.phase === 'ready' && list.data.length === 0 && (
        <p style={{ color: theme.color.muted }}>No polls yet.</p>
      )}

      {list.phase === 'ready' &&
        list.data.map((p) => (
          <div
            key={p.id}
            style={{
              border: `1px solid ${theme.color.surfaceBorder}`,
              borderRadius: theme.radius.md,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <strong>{p.title}</strong>
                <div style={{ color: theme.color.subtle, fontSize: '.78rem', marginTop: 2 }}>
                  {p.slug} · {p.status}
                  {p.isOpen ? ' · accepting votes' : ''} · results {p.resultsVisibility}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {p.status === 'draft' && (
                <Button disabled={busyId === p.id} onClick={() => void transition(p.id, 'open')}>
                  Open
                </Button>
              )}
              {p.status === 'open' && (
                <Button
                  variant="secondary"
                  disabled={busyId === p.id}
                  onClick={() => void transition(p.id, 'close')}
                >
                  Close
                </Button>
              )}
              {p.status === 'closed' && (
                <Button
                  variant="secondary"
                  disabled={busyId === p.id}
                  onClick={() => void transition(p.id, 'archive')}
                >
                  Archive
                </Button>
              )}
              <Button variant="secondary" onClick={() => void showResults(p.id)}>
                Results
              </Button>
            </div>

            {results[p.id] && (
              <div style={{ marginTop: 10, fontSize: '.85rem' }}>
                <div style={{ color: theme.color.muted }}>
                  {results[p.id].totalVoters} voter(s), {results[p.id].totalSelections} selection(s)
                </div>
                {results[p.id].options.map((o) => (
                  <div key={o.optionId} style={{ color: theme.color.text }}>
                    {o.label}: <strong>{o.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
    </Section>
  );
}

function CreatePoll({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = optionsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await adminPolls.create({
        slug,
        title,
        // Opens immediately, but the poll still starts as a draft — an admin
        // must explicitly Open it, so nothing goes live by accident.
        opensAt: new Date().toISOString(),
        options: options.map((label) => ({ label })),
      });
      setTitle('');
      setSlug('');
      setOptionsText('');
      await onCreated();
    } catch (e) {
      const code = e instanceof KiconApiError ? e.code : '';
      setError(
        code === 'slug_taken'
          ? 'That slug is already in use.'
          : code === 'validation_failed'
            ? 'Check the fields: slug must be lowercase letters, numbers and hyphens.'
            : e instanceof Error
              ? e.message
              : 'Could not create the poll.',
      );
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: 8,
    marginBottom: 8,
    background: theme.color.inset,
    border: `1px solid ${theme.color.insetBorder}`,
    borderRadius: theme.radius.sm,
    color: theme.color.text,
    font: theme.font,
  } as const;

  return (
    <div
      style={{
        border: `1px solid ${theme.color.surfaceBorder}`,
        borderRadius: theme.radius.md,
        padding: 12,
        marginBottom: 14,
      }}
    >
      <input
        style={inputStyle}
        placeholder="Question"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          // Suggest a slug, but leave it editable — it is part of the URL and
          // unique per org, so the admin may need to disambiguate.
          if (!slug || slug === autoSlug(title)) setSlug(autoSlug(e.target.value));
        }}
      />
      <input
        style={inputStyle}
        placeholder="slug (lowercase, hyphens)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <textarea
        style={{ ...inputStyle, minHeight: 90 }}
        placeholder={'One option per line\nFox\nOwl\nOctopus'}
        value={optionsText}
        onChange={(e) => setOptionsText(e.target.value)}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button onClick={() => void submit()} disabled={busy || !title || !slug || options.length < 2}>
        {busy ? 'Creating…' : 'Create as draft'}
      </Button>
      {options.length < 2 && (
        <span style={{ color: theme.color.subtle, fontSize: '.8rem', marginLeft: 10 }}>
          At least two options.
        </span>
      )}
    </div>
  );
}

function autoSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function toError(e: unknown): { phase: 'error'; message: string; code?: string } {
  if (e instanceof KiconApiError) {
    if (e.isUnavailable) {
      return {
        phase: 'error',
        message: 'The service is temporarily unavailable. Please try again.',
        code: e.code,
      };
    }
    if (e.isAuthError) {
      // The admin surface has no refresh token by design: its session IS the
      // access token's lifetime, so expiry means signing in again (with MFA).
      return {
        phase: 'error',
        message: 'Your admin session has expired. Sign in again to continue.',
        code: e.code,
      };
    }
    return { phase: 'error', message: e.message, code: e.code };
  }
  return { phase: 'error', message: e instanceof Error ? e.message : String(e) };
}
