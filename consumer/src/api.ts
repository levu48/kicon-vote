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

export const votes = {
  list: () => api.get<{ polls: PollSummary[] }>('/v1/vote/polls'),
  detail: (id: string) => api.get<PollDetail>(`/v1/vote/polls/${id}`),
  cast: (id: string, optionIds: string[]) =>
    api.post<{ pollId: string; optionIds: string[]; revision: number; changed: boolean }>(
      `/v1/vote/polls/${id}/ballot`,
      { optionIds },
    ),
  withdraw: (id: string) => api.del<{ withdrawn: boolean }>(`/v1/vote/polls/${id}/ballot`),
  results: (id: string) => api.get<PollResults>(`/v1/vote/polls/${id}/results`),
};
