import { createApiClient, KiconApiError } from '@kicon/platform/api';
import { auth } from './auth';

/**
 * Client for api.kicon.com, bound to this surface's auth client so the access
 * token has exactly one home. Token attachment, one silent-renew-and-replay on
 * 401, and the error envelope decoding all live in @kicon/platform/api.
 */
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE,
  auth,
});

export { KiconApiError };

/** Shapes returned by the vote routes. Mirrors the API's responses. */
export interface PollSummary {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
  isOpen: boolean;
  opensAt: string;
  closesAt: string | null;
  maxSelections: number;
  allowChangeVote: boolean;
}

export interface PollOption {
  id: string;
  label: string;
  position: number;
}

export interface PollDetail extends PollSummary {
  description: string | null;
  resultsVisibility: 'always' | 'after_close' | 'admin_only';
  ballotSecrecy: 'attributable' | 'private';
  options: PollOption[];
  myBallot: { voted: boolean; optionIds: string[]; revision: number | null };
}

export interface PollResults {
  pollId: string;
  totalVoters: number;
  totalSelections: number;
  options: { optionId: string; label: string; position: number; count: number }[];
}

export interface AdminPollSummary extends PollSummary {
  orgId: string | null;
  eligibilityMode: 'open' | 'org_member' | 'allowlist';
  resultsVisibility: 'always' | 'after_close' | 'admin_only';
}

export interface CreatePollInput {
  slug: string;
  title: string;
  description?: string;
  opensAt: string;
  closesAt?: string;
  maxSelections?: number;
  allowChangeVote?: boolean;
  resultsVisibility?: 'always' | 'after_close' | 'admin_only';
  options: { label: string }[];
}

/**
 * Admin routes. Every one requires vote:admin scope + MFA (acr=loa2) + a
 * poll_manager role at the API — holding the scope alone is not enough, since
 * everyone who signs in at this origin receives it.
 */
export const adminPolls = {
  list: () => api.get<{ polls: AdminPollSummary[] }>('/v1/vote/admin/polls'),
  detail: (id: string) =>
    api.get<PollDetail & { participantCount: number }>(`/v1/vote/admin/polls/${id}`),
  create: (input: CreatePollInput) =>
    api.post<{ id: string; slug: string; status: string }>('/v1/vote/admin/polls', input),
  open: (id: string) => api.post<{ id: string; status: string }>(`/v1/vote/admin/polls/${id}/open`),
  close: (id: string) =>
    api.post<{ id: string; status: string }>(`/v1/vote/admin/polls/${id}/close`),
  archive: (id: string) =>
    api.post<{ id: string; status: string }>(`/v1/vote/admin/polls/${id}/archive`),
  results: (id: string) => api.get<PollResults>(`/v1/vote/admin/polls/${id}/results`),
};
